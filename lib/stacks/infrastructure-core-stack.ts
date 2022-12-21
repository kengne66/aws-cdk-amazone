import * as  cdk from 'aws-cdk-lib';
import {App, Duration, RemovalPolicy} from 'aws-cdk-lib';
import {DeploymentEnvironment, DeploymentStack, DeploymentStackProps, SoftwareType} from "@amzn/pipelines";
import * as iam from "aws-cdk-lib/aws-iam";
import {Effect} from "aws-cdk-lib/aws-iam";
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from "aws-cdk-lib/aws-s3";
import {Construct} from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2'

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