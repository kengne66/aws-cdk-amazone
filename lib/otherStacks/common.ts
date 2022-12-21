import { SecurityGroup } from 'aws-cdk-lib/aws-ec2'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as cdk from 'aws-cdk-lib';
import * as targets from 'aws-cdk-lib/aws-events-targets'
import {aws_ec2} from "aws-cdk-lib";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from "aws-cdk-lib/aws-ec2";

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