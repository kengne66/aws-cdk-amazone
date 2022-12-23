import * as cdk from 'aws-cdk-lib';
import {
    Stack,
    StackProps,
    CfnOutput,
    Duration,
    RemovalPolicy, aws_ec2,
} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import {DeploymentStack, DeploymentStackProps} from "@amzn/pipelines";
import {FrontEndLambdaProps} from "./lambda-stack";

export interface AuroraDBProps extends DeploymentStackProps {
    readonly stage: string;
    readonly vpcId: string;
    readonly subnetIds?:string [];
    readonly dbName?: string;
    readonly vpcSubnets: string[]
    readonly availabiltyZones: string[]
    readonly auroraClusterUsername?: string;
    readonly backupRetentionDays?: number;
    readonly engine?: string;
    readonly enableBabelfish?:boolean;
    readonly ingressSources?: any[];
}


export class AuroraDBStack extends DeploymentStack {
    constructor(scope: Construct, id: string, readonly props: AuroraDBProps) {
        super(scope, id, props);


        var ingressSources = [];
        if (typeof props.ingressSources !== 'undefined') {
            ingressSources = props.ingressSources;
        }

        const dbs = ['mysql', 'postgresql'];
        if (!dbs.includes(props.engine!)) {
            throw new Error('Unknown Engine Please Use mysql or postgresql');
            process.exit(1);
        }

        // vpc
        const vpc = ec2.Vpc.fromVpcAttributes(this, 'ExistingVPC', {
            vpcId: this.props.vpcId,
            availabilityZones: this.props.availabiltyZones,
            privateSubnetIds: this.props.vpcSubnets
        });

        const subnets: any[] = [];

        for (let subnetId of props.subnetIds!) {
            const subid = subnetId
                .replace('-', '')
                .replace('_', '')
                .replace(' ', '');
            subnets.push(
                ec2.Subnet.fromSubnetAttributes(this, subid, {
                    subnetId: subid,
                }),
            );
        }

        const vpcsubnets: ec2.SubnetSelection = {
            subnets: subnets,
        };

        // all the ports
        const allAll = ec2.Port.allTraffic();
        const tcp3306 = ec2.Port.tcpRange(3306, 3306);
        const tcp5432 = ec2.Port.tcpRange(5432, 5432);
        const tcp1433 = ec2.Port.tcpRange(1433, 1433);

        let connectionPort: any;
        let connectionName: string;

        // Database Security Group
        const dbsg = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
            vpc: vpc,
            allowAllOutbound: true,
            description: id + 'Database',
            securityGroupName: id + 'Database',
        });

        //Import Lambda function Security Group
        //const lambda_dbsg = ec2.SecurityGroup.fromSecurityGroupId(this, 'Lambda security group', 'sg-0d83ae2466c26e6fb')

        dbsg.addIngressRule(dbsg, allAll, 'all from self');
        dbsg.addEgressRule(ec2.Peer.ipv4('0.0.0.0/0'), allAll, 'all out');

        //dbsg.connections.allowFrom(new ec2.Connections({securityGroups: [lambda_dbsg],}),
         //   ec2.Port.tcp(5432), 'allow traffic on port 5432 from the Lambda security group');

        if (props.engine == 'mysql') {
            connectionPort = tcp3306;
            connectionName = 'tcp3306 MySQL';
        } else {
            connectionPort = tcp5432;
            connectionName = 'tcp5432 PostgresSQL';
        }

        for (let ingress_source of ingressSources!) {
            dbsg.addIngressRule(ingress_source, connectionPort, connectionName);
            if (props.engine == 'postgresql') {
                dbsg.addIngressRule(ingress_source, tcp1433, 'tcp1433');
            }
        }

        const lambdaSGId = aws_ec2.SecurityGroup.fromSecurityGroupId(this, 'LamdaFunctionSecurityGroup', cdk.Fn.importValue(`${this.props.stage}OutputBackendSG`))
        dbsg.addIngressRule(lambdaSGId, connectionPort)


        // Declaring postgres engine
        let auroraEngine = rds.DatabaseClusterEngine.auroraPostgres({
            version: rds.AuroraPostgresEngineVersion.VER_11_13,
        });

        const auroraClusterSecret = new secretsmanager.Secret(
            this,
            'AuroraClusterCredentials',
            {
                secretName: props.stage + 'AuroraClusterCredentials',
                description: props.stage + 'AuroraClusterCrendetials',
                generateSecretString: {
                    excludeCharacters: "\"@/\\ '",
                    secretStringTemplate: JSON.stringify({ username: "postgres" }),
                    generateStringKey: 'password',
                    passwordLength: 30,
                },
            },
        )

        // aurora credentials
        const auroraClusterCrendentials= rds.Credentials.fromSecret(
            auroraClusterSecret,
            props.auroraClusterUsername
        );

        // Aurora DB Key
        const kmsKey = new kms.Key(this, 'AuroraDatabaseKey', {
            enableKeyRotation: false,
            pendingWindow: Duration.days(14),
            alias: props.dbName,
        });

        const subnetGroup = new rds.SubnetGroup(this, 'auroraDBSubnetGroup', {
            description: 'serverless SubnetGroup',
            vpc: vpc,
            // the properties below are optional
            removalPolicy: RemovalPolicy.DESTROY,
            subnetGroupName: props.dbName + 'SubnetGroup',
        });


        const aurora_cluster = new rds.ServerlessCluster(this, 'AuroraDatabase-Cluster', {
            engine: auroraEngine,
            vpc : vpc,
            vpcSubnets: vpcsubnets,
            securityGroups: [dbsg],
            clusterIdentifier: 'Auroradbcluster-serverles',
            defaultDatabaseName: props.dbName,
            credentials: auroraClusterCrendentials,
            backupRetention : Duration.days(7),
            deletionProtection: false,
            enableDataApi : true,
            removalPolicy: RemovalPolicy.DESTROY,
            subnetGroup : subnetGroup ,
            // parameterGroup: auroraParameterGroup,
            storageEncryptionKey: kmsKey,
            scaling: {
                autoPause: Duration.hours(23), // default is to pause after 5 minutes of idle time
                minCapacity: rds.AuroraCapacityUnit.ACU_2, // default is 2 Aurora capacity units (ACUs)
                maxCapacity: rds.AuroraCapacityUnit.ACU_32 // default is 16 Aurora capacity units (ACUs)
            }
        });


        new CfnOutput(this, 'OutputSecretName', {
            exportName: aurora_cluster.stack.stackName+':SecretName',
            value: aurora_cluster.secret?.secretArn!,
        });

        new CfnOutput(this, 'OutputSecretArn', {
            exportName: aurora_cluster.stack.stackName+':SecretArn',
            value: aurora_cluster.secret?.secretArn!,
        });

        new CfnOutput(this, 'OutputClusterEndpoint', {
            exportName: aurora_cluster.stack.stackName+':Endpoint',
            value: aurora_cluster.clusterEndpoint.socketAddress,
        });


    }

}


