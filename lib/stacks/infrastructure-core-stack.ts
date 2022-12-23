import * as  cdk from 'aws-cdk-lib';
import {App, Duration, RemovalPolicy} from 'aws-cdk-lib';
import {DeploymentEnvironment, DeploymentStack, DeploymentStackProps, SoftwareType} from "@amzn/pipelines";
import * as iam from "aws-cdk-lib/aws-iam";
import {Effect} from "aws-cdk-lib/aws-iam";
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from "aws-cdk-lib/aws-s3";
import {Construct} from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import {aws_ec2} from "aws-cdk-lib";
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const stageName = "prod"
process.env.AWS_SDK_LOAD_CONFIG = 'true';


export interface InfrastructureProps extends DeploymentStackProps {
    readonly stage: string;

}


export class amamzonRDEInfrastructureCoreStack extends DeploymentStack {
    constructor(scope: Construct, id: string, readonly props: InfrastructureProps) {
        super(scope, id, props);


        // Call the project vpc
        const myVpc = ec2.Vpc.fromLookup(this, 'project-vpc', {
            vpcName: 'ar-tgw-vpc',
        });


        // kms key for Database base secret

        const myCustomPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: "Allow administration of the key",
                    effect: Effect.ALLOW,
                    actions: [
                        "kms:Create*",
                        "kms:Describe*",
                        "kms:Enable*",
                        "kms:List*",
                        "kms:Put*",
                        "kms:Update*",
                        "kms:Revoke*",
                        "kms:Disable*",
                        "kms:Get*",
                        "kms:Delete*",
                        "kms:ScheduleKeyDeletion",
                        "kms:CancelKeyDeletion"
                    ],
                    principals: [new iam.AccountRootPrincipal()],
                    resources: ['*'],
                }),

                new iam.PolicyStatement({
                    sid: "Allow use of the key",
                    effect: Effect.ALLOW,
                    actions: [
                        "kms:Encrypt",
                        "kms:Decrypt",
                        "kms:ReEncrypt",
                        "kms:GenerateDataKey*",
                        "kms:DescribeKey"
                    ],
                    principals: [new iam.ArnPrincipal(
                        `arn:aws:iam::${cdk.Stack.of(this).account}:user/Administrator`,
                    )],
                    resources: ['*'],
                }),
            ],
        });


        // [ { "AWS": "arn:aws:iam::424975656753:user/PierreK" }]
        /*
        const kmsKey = new kms.Key(this, 'amazonRDEAuroraKey' + stageName, {
            enableKeyRotation: true,
            policy: myCustomPolicy,
            alias: 'amazoneRDE_AuroraKey' + this.props.stage,
            description: 'KMS key for encrypting the Aurora Database',
        });


        // Database secret
        const auroraClusterSecret = new secretsmanager.Secret(
            this,
            'AuroraCredentials' + this.props.stage,
            {
                secretName: 'AuroraCredentials' + this.props.stage,
                description: 'AuroraClusterCrendetials',
                generateSecretString: {
                    excludeCharacters: "\"@/\\ '",
                    generateStringKey: 'password',
                    passwordLength: 30,
                    secretStringTemplate: `{"username": "postgres"}`,
                },
            },
        );

         */


        const artifactBucket = new s3.Bucket(this, `AmanzonRDEApplicationAssetucket${props.stage}`, {
            bucketName: `amanzonrdeapplicationassetbucket${props.stage}`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            lifecycleRules: [
                { abortIncompleteMultipartUploadAfter: Duration.days(7) },
                { noncurrentVersionExpiration: Duration.days(7) },
            ],


            /**
             * The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
             * the new bucket, and it will remain in your account until manually deleted. By setting the policy to
             * DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.

             */

            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code

            /**
             * For sample purposes only, if you create an S3 bucket then populate it, stack destruction fails.  This
             * setting will enable full cleanup of the demo.
             */

            autoDeleteObjects: true, // NOT recommended for production code
        });



        /*
        const lambdafunctionsBucket = new s3.Bucket(this, 'AmanzonRDEfunctionsBucke' + this.props.stage, {
            bucketName: "amanzonrdelambdafunctions" + this.props.stage,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            lifecycleRules: [
                { abortIncompleteMultipartUploadAfter: Duration.days(7) },
                { noncurrentVersionExpiration: Duration.days(7) },
            ],


            /**
             * The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
             * the new bucket, and it will remain in your account until manually deleted. By setting the policy to
             * DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.

            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code

            /**
             * For sample purposes only, if you create an S3 bucket then populate it, stack destruction fails.  This
             * setting will enable full cleanup of the demo.

            autoDeleteObjects: true, // NOT recommended for production code
        });

         */


        const psrBucket = new s3.Bucket(this, 'AmanzonRDEPsrBucket' + this.props.stage, {
            bucketName: `psrdocumentsbucket-${props.stage}`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            /**
             * The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
             * the new bucket, and it will remain in your account until manually deleted. By setting the policy to
             * DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.
             */
            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code

            /**
             * For sample purposes only, if you create an S3 bucket then populate it, stack destruction fails.  This
             * setting will enable full cleanup of the demo.
             */
            autoDeleteObjects: true, // NOT recommended for production code
        });

    }
}

interface BackendLambdaProps {
    name: string
    handler: string
    schedule?: string
    timeoutMinutes?: number
    memorySize?: number
    environment?: { [key: string]: string }
}

interface BackendLambdaEventProps {
    schedule: string
    eventJson: any
    eventName: string
    eventDescription: string
    function: lambda.Function
}

export function createSecurityGroup(stack: any, name: string, description?: string) {

    const SGVPC = aws_ec2.Vpc.fromVpcAttributes(stack, 'SG-vpc', {
        vpcId: stack.props.vpcID,
        availabilityZones: stack.props.availabiltyZone,
        privateSubnetIds: stack.props.vpcSubnets

    });

    const sgName = name
    const SG = new SecurityGroup(stack, sgName, {
    // return new SecurityGroup(stack, sgName, {
        securityGroupName: sgName,
        vpc: SGVPC,
        allowAllOutbound: true,
        description: description,
    })

    //dbsg.addIngressRule(aws_ec2.Peer.ipv4('10.16.8.0/25'), aws_ec2.Port.tcp(443))
    //dbsg.addIngressRule(stack.props.vpc.subnets[0], aws_ec2.Port.allTraffic())

    return SG
}

export function createLambdaRole(stack: any, name: string) {
    const roleName = name
    const role = new Role(stack, roleName, {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        roleName: roleName,
    })

    // allow running in VPC
    role.addToPolicy(
        new PolicyStatement({
            actions: [
                'ec2:CreateNetworkInterface',
                'ec2:DescribeNetworkInterfaces',
                'ec2:DeleteNetworkInterface',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeSubnets',
            ],
            resources: ['*'],
        })
    )

    // allow all needed for lambdas
    role.addToPolicy(
        new PolicyStatement({
            actions: [
                'rds:*',
                's3:*',
                'ssm:*',
                'dynamodb:*',
                'athena:*',
                'sts:*',
                'cloudwatch:*',
                'secretsmanager:GetSecretValue',
                'secretsmanager:ListSecrets',
                'kms:Decrypt',
                'logs:*',
                'glue:GetTable',
                'glue:GetPartitions',
                'lambda:InvokeFunction',
                'ses:SendRawEmail',
                //Adding access to query from lake formation resource for COE data in Metis Data Lake for Aerial View Metric.
                'lakeformation:GetDataAccess',
            ],
            resources: ['*'],
        })
    )

    return role
}

export function createLambda(stack: any, lambdaProps: BackendLambdaProps) {
    const func = new lambda.Function(stack, lambdaProps.name, {
        vpc: stack.props.vpc,
        functionName: lambdaProps.name,
        code: stack.lambdaCode,
        role: stack.lambdaRole,
        handler: lambdaProps.handler,
        memorySize: lambdaProps.memorySize || 3072,
        timeout: cdk.Duration.minutes(lambdaProps.timeoutMinutes || 15),
        runtime: lambda.Runtime.PYTHON_3_8,
        securityGroups: [stack.lambdaSg],
        logRetention: RetentionDays.ONE_MONTH,
        environment: lambdaProps.environment || {},
    })

    if (lambdaProps.schedule && stack.props.stageName == 'Prod') {
        const ruleName = lambdaProps.name + 'Rule'
        new Rule(stack, ruleName, {
            ruleName: ruleName,
            schedule: Schedule.expression(lambdaProps.schedule),
            targets: [new targets.LambdaFunction(func)],
        })
    }


    // Returning the function so that it can be used as a parameter for other components (Eg: Eventbridge rule) in the stack
    return func
}

export function createEvent(stack: any, props: BackendLambdaEventProps) {
    const ruleName = props.eventName
    new Rule(stack, ruleName, {
        ruleName: ruleName,
        schedule: Schedule.expression(props.schedule),
        description: props.eventDescription,
        targets: [
            new targets.LambdaFunction(props.function, {
                event: RuleTargetInput.fromObject(props.eventJson),
            }),
        ],
    })
}

//Method to generate lambda schedules that are 5 minutes apart in a cyclic manner for to prevent overload of resources.
//Method returns a cron job schedule of 2-3 AM UTC on first day of every month.
export class lambdaScheduler {
    getLambdaSchedule = (function () {
        let minutes = 0
        function generateSchedule(this: lambdaScheduler) {
            if (minutes > 55) {
                minutes = 0
            }
            const schedule = 'cron(' + minutes + ', 2, 1, *, ?, *)'
            minutes = minutes + 5
            return schedule
        }
        return generateSchedule
    })()
}



export interface LambdaIntegrationOnePermissionOnlyOptions extends  apigateway.LambdaIntegrationOptions {
    restApi: apigateway.IRestApi
}

export class LambdaIntegrationOnePermissionOnly extends apigateway.LambdaIntegration {

    constructor(handler: lambda.IFunction, options: LambdaIntegrationOnePermissionOnlyOptions) {
        super(handler, options);

        handler.addPermission('apigw-permissions', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: options.restApi.arnForExecuteApi()
        });
    }
    bind1(method: apigateway.Method) {
    //bind(method: apigateway.Method): apigateway.IntegrationConfig {
        //const integrationConfig = super.bind(method);

        // Remove all AWS::Lambda::Permission on methods
        const permissions = method.node.children.filter(c => c instanceof lambda.CfnPermission);
        permissions.forEach(p => method.node.tryRemoveChild(p.node.id));
        //return integrationConfig;
    }
}