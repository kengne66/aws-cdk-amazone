import * as cdk from 'aws-cdk-lib';
import { Construct} from 'constructs';
import { BrazilPackage, DeploymentStack, DeploymentStackProps } from '@amzn/pipelines';
import {CfnOutput, Duration} from 'aws-cdk-lib';
import { LambdaAsset } from '@amzn/pipelines';
import {Alias, Function, Runtime, LayerVersion} from 'aws-cdk-lib/aws-lambda';
import {aws_lambda} from "aws-cdk-lib"
import {IVpc, SecurityGroup} from "aws-cdk-lib/aws-ec2";
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from "aws-cdk-lib/aws-lambda";
import {createLambda, createLambdaRole, createSecurityGroup, LambdaIntegrationOnePermissionOnly} from './stacks/common'
import {createRole} from "aws-cdk-lib/aws-autoscaling-hooktargets";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import {constants} from "http2";
import {HttpMethod} from "aws-cdk-lib/aws-events";
import * as iam from 'aws-cdk-lib/aws-iam';
import {ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {int} from "aws-sdk/clients/datapipeline";


export interface FrontEndLambdaProps extends DeploymentStackProps {
    readonly stage: string;
    readonly vpcID: string
    readonly vpcSubnets: string[]
    readonly availabiltyZone: string[]
    readonly apiEndPointUrl: string
    readonly psrAgileFileUploadUrl: string
    readonly frontendlambdaFunctionPackageName: string
    readonly backendlambdaFunctionPackageName: string
    readonly lambdaLayerPackageName: string
    readonly authorizerUrl?: string
    readonly region: string
    readonly awsaccountid: string
    readonly agilePLMCidrIP: string
    readonly agilePLMEgressPort: number
    readonly oracleCidrIP: string
    readonly oraclegressPort: number
    readonly listOfPrivateSubnetsCdrBlock: string[]
    readonly uatUserPoolArn: string
    readonly prodUserPoolArn: string
    readonly oracleValidate: string
    readonly oracleSearchLoadNumber: string
    readonly oracleSearchDeliveryNumber: string
    readonly oracleSearchDestinationCode: string
    readonly oracleSearchItemNumber: string
    readonly oracleSearchPsrNumber: string
    readonly oracleSearchProductLine: string
    readonly oracleSearchItemDescription: string
    readonly oracleFilterData: string
    readonly oracleFilterShipStatus: string
    readonly oracleSearchReceiptStatus: string
    readonly oracleDailyGraphSiteCode: string
    readonly oracleWeeklyGraphSiteCode: string
    readonly oracleSubmitData: string
    readonly oracleValidateSubmit: string
    readonly dbSecretName: string
}


export class FrontEndLambdaStack extends DeploymentStack {


    constructor(scope: Construct, id: string, readonly props: FrontEndLambdaProps) {
        super(scope, id, props);

        // Project vpc including only the pprivate subnets to be used
        const projectVPC = ec2.Vpc.fromVpcAttributes(this, 'project-vpc', {
            vpcId: this.props.vpcID,
            availabilityZones: this.props.availabiltyZone,
            privateSubnetIds: this.props.vpcSubnets

        });

        // lambda layer for the functions
        const frontEndLayer = new LayerVersion(this, 'front-end-layer', {
            code: LambdaAsset.fromBrazil({
                brazilPackage: BrazilPackage.fromString(`${this.props.lambdaLayerPackageName}-1.0`),
                componentName: 'frontendlambdalayer'
            }),
            compatibleRuntimes: [
                Runtime.NODEJS_14_X
            ]
        });
/*
        const subnet = new ec2.CfnSubnet(this, "subnet-", {
            availabilityZone: availability_zone,
            cidrBlock: this.cidr + subnet_cidr,
            vpcId: this.vpc.ref,
            tags: [
                { key: "Name", value: this.svc + "-" + this.env + "-" + subnet_name },
            ],
        });

 */
        // Frontend lambda function, first: lambdarole, 2nd Security group, 3rd the lambda integration function
        const projectRole = createLambdaRole(this, "psrFunctionsLambdaRole")

        const FrontEndSG = new SecurityGroup(this, 'FrontEndSecurityGroup', {
            // return new SecurityGroup(stack, sgName, {
            securityGroupName: 'FrontEndSecurityGroup',
            vpc: projectVPC,
            allowAllOutbound: true,
            description: "Security Group for Frontend function",
        })

        FrontEndSG.addIngressRule(ec2.Peer.ipv4(this.props.agilePLMCidrIP), ec2.Port.tcp(this.props.agilePLMEgressPort))

        for (let ipCdrBlock of this.props.listOfPrivateSubnetsCdrBlock) {
            FrontEndSG.addIngressRule(ec2.Peer.ipv4(ipCdrBlock), ec2.Port.allTcp())
        }

        const FrontEndLambdaFunction = new Function(this, `FrontEndFunct${this.props.stage}`, {
            functionName: `FrontEndFunct${this.props.stage}`,
            code: LambdaAsset.fromBrazil({
                brazilPackage: BrazilPackage.fromString(`${this.props.frontendlambdaFunctionPackageName}-1.0`),
                componentName: `frontendlambda${this.props.stage}`,
            }),
            environment: {
                //myEnvVariable: 'some value',
                API_ENDPOINT_URL: this.props.apiEndPointUrl,
                AWS_PARAMETER_STORE: 'psrimprovement-lambdafunction-imagestore',
                PSR_AGILE_FILE_UPLOAD_URL: this.props.psrAgileFileUploadUrl,
                ALLOWED_ORIGIN: '',
                PSR_SECRET_MANAGER_NAME: 'agilecredentials',
                APPLICATION_ASSET_PARAMETER_STORE: 'psrimprovement-lambdafunction',
                ORACLE_VALIDATE: this.props.oracleValidate,
                ORACLE_SEARCH_LOADNUMBER: this.props.oracleSearchLoadNumber,
                ORACLE_SEARCH_DELIVERYNUMBER: this.props.oracleSearchDeliveryNumber,
                ORACLE_SEARCH_DESTINATIONCODE: this.props.oracleSearchDestinationCode,
                ORACLE_SEARCH_ITEMNUMBER: this.props.oracleSearchItemNumber,
                ORACLE_SEARCH_PSRNUMBER: this.props.oracleSearchPsrNumber,
                ORCALE_SEARCH_PRODUCTLINE: this.props.oracleSearchProductLine,
                ORACLE_SEARCH_ITEMDESCRIPTION: this.props.oracleSearchItemDescription,
                ORACLE_FILTER_DATA: this.props.oracleFilterData,
                ORACLE_FILTER_SHIPSTATUS: this.props.oracleFilterShipStatus,
                ORACLE_SEARCH_RECEIPTSTATUS: this.props.oracleSearchReceiptStatus,
                ORACLE_DAILY_GRAPH_SITECODE: this.props.oracleDailyGraphSiteCode,
                ORACLE_WEEKLY_GRAPH_SITECODE: this.props.oracleWeeklyGraphSiteCode,
                ORACLE_SUBMIT_DATA: this.props.oracleSubmitData,
                ORACLE_VALIDATE_SUBMIT: this.props.oracleValidateSubmit,

            },

            role: projectRole,
            layers: [frontEndLayer],
            vpc: projectVPC,
            securityGroups: [FrontEndSG],

            handler: 'api-entry-point.handler',
            memorySize: 512,
            timeout: Duration.seconds(30),
            runtime: Runtime.NODEJS_14_X
        });


        // Backend lambda function: Security group, and the lambda integration function

        const BackendSG = new SecurityGroup(this, 'BackendSecurityGroup', {
            // return new SecurityGroup(stack, sgName, {
            securityGroupName: 'BackendSecurityGroup',
            vpc: projectVPC,
            allowAllOutbound: true,
            description: "Security Group for backend function",
        })
        BackendSG.addIngressRule(ec2.Peer.ipv4(this.props.oracleCidrIP), ec2.Port.tcp(this.props.oraclegressPort))
        for (let ipCdrBlock of this.props.listOfPrivateSubnetsCdrBlock) {
            BackendSG.addIngressRule(ec2.Peer.ipv4(ipCdrBlock), ec2.Port.allTcp())
        }

        new CfnOutput(this, `${this.props.stage}OutputBackendSG`, {
            exportName: `${this.props.stage}OutputBackendSG`,
            value: BackendSG.securityGroupId,
        });


        const BackEndLambdaFunction = new Function(this, `BackEndFunction${this.props.stage}`, {
            functionName: `BackEndFunction${this.props.stage}`,
            code: LambdaAsset.fromBrazil({
                brazilPackage: BrazilPackage.fromString(`${this.props.backendlambdaFunctionPackageName}-1.0`),
                componentName: `backendlambda${this.props.stage}`,
            }),
            environment: {
                //myEnvVariable: 'some value',
                DB_SECRET_NAME: this.props.dbSecretName
            },

            role: projectRole,
            layers: [frontEndLayer],
            vpc: projectVPC,
            securityGroups: [BackendSG],

            handler: 'api-entry-point.handler',
            memorySize: 512,
            timeout: Duration.seconds(30),
            runtime: Runtime.NODEJS_14_X
        });



        // ApiGateway
        const LambdaRestApi = new apigw.RestApi(this, `${this.props.stage} -LambdaRestApi`, {
            restApiName: `${this.props.stage} Apigateway`,
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
            },
            endpointConfiguration: {
                types: [apigw.EndpointType.REGIONAL]
            },
            defaultMethodOptions: {
                authorizationType: apigw.AuthorizationType.NONE
            },
            deployOptions: {
                // 👇 update stage name to `dev`
                stageName: this.props.stage
            }
        });

        const lambdaRestApiId = LambdaRestApi.restApiId;

        // frontend lambda function Resource policy for the api gateway

        FrontEndLambdaFunction.addPermission('apigatewaypermission-frontend1',{
            principal: new ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${this.props.region}:${this.props.awsaccountid}:${lambdaRestApiId}/*/*/*`
        })
        FrontEndLambdaFunction.addPermission('apigatewaypermission-frontend2',{
            principal: new ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${this.props.region}:${this.props.awsaccountid}:${lambdaRestApiId}/*/*/*/*`
        })


        // backend lambda function Resource policy for the api gateway
        BackEndLambdaFunction.addPermission('apigatewaypermission',{
            principal: new ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${this.props.region}:${this.props.awsaccountid}:${lambdaRestApiId}/*/*/*/*/*`
        })
        BackEndLambdaFunction.addPermission('apigatewaypermission2',{
            principal: new ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${this.props.region}:${this.props.awsaccountid}:${lambdaRestApiId}/*/*/*/*`
        })


        //Authorizers for the apis

        const authorizerLambdaFunction = new lambda.Function(this, 'Image lambda function', {
            runtime:lambda.Runtime.NODEJS_14_X,    // execution environment
            //role: psrdevlambdarole,   // the lambda Role
            code: lambda.Code.fromAsset('lib/lambda'),  // code loaded from "lambda" directory
            handler: 'imagelambda.handler',
            architecture: lambda.Architecture.ARM_64,
            vpc: projectVPC
            //securityGroups: [sg],
        });

         const autorizerFunctionArn = authorizerLambdaFunction.functionArn


        let userpool
        if (this.props.stage == 'prod') {
            userpool = cognito.UserPool.fromUserPoolArn(this, 'test', cdk.Fn.importValue(`${this.props.stage}userPoolArn`));
            //  userpool = cognito.UserPool.fromUserPoolArn(this, 'test', cdk.Fn.importValue(`${this.props.stage}userPoolArn`));
            // userpool = cognito.UserPool.fromUserPoolArn(this,'Cognitoreference', this.props.prodUserPoolArn);
            //userpool = cognito.UserPool.fromUserPoolArn(this, 'test', 'arn:aws:cognito-idp:us-east-2:359643179693:userpool/us-east-2_888yX1xsV');

        } else {
            userpool = cognito.UserPool.fromUserPoolArn(this,'Cognitoreference', this.props.uatUserPoolArn);
            //userpool = cognito.UserPool.fromUserPoolArn(this,'Cognitoreference', 'arn:aws:cognito-idp:us-east-2:281368221808:userpool/us-east-2_zIJtJAJ6S');
        }



        // Authorizer for the Hello World API that uses the
        // Cognito User pool to Authorize users.
        const authorizer = new apigw.CfnAuthorizer(this, `${this.props.stage}-Lambda-CognitoAuthorizer`, {
            restApiId: LambdaRestApi.restApiId,
            name: `${this.props.stage}-Lambda-CognitoAuthorizer`,
            type: 'COGNITO_USER_POOLS',
            identitySource: 'method.request.header.Authorization',
            providerArns: [userpool.userPoolArn],
        })


        const lambdaauthorizer = new apigw.CfnAuthorizer(this, `${this.props.stage}-lambdaApiauthorizer`, {
            restApiId: LambdaRestApi.restApiId,
            name: `${this.props.stage}-LambdaApiAuthorizer`,
            type: 'TOKEN',
            authorizerUri: `arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/${autorizerFunctionArn}/invocations`,
            // `arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:359643179693:function:amazonRDEImproveCDK1-Fron-Imagelambdafunction68736-SKFsDL8m1RcR/invocations`
            //authorizerUri: this.props.authorizerUrl,
            identitySource: 'method.request.header.Authorization'
        })



        const frontendPermission = new LambdaIntegrationOnePermissionOnly(FrontEndLambdaFunction, {
            restApi: LambdaRestApi

        })


        // Lambda API for the REST API.
        const api = LambdaRestApi.root.addResource('api');

        // GET method for the HELLO API resource. It uses Cognito for
        // authorization and the auathorizer defined above.
        api.addMethod('GET', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })


        // /api/getcustomersitecode
        const getCustomerSiteCode = api.addResource("getcustomersitecode");
        const getCustomerSiteCodeMethod = getCustomerSiteCode.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(getCustomerSiteCodeMethod)

        // /api/appimages
        const appimages = api.addResource("appimages");
        appimages.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.NONE,
        });



        // /api/getitemnumberwithdescription
        const getItemNumberWithDescription = api.addResource("getitemnumberwithdescription");
        const getItemNumberWithDescriptionMethod = getItemNumberWithDescription.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(getItemNumberWithDescriptionMethod)

        // /api/gettlapartnumber
        const getTlaPartNumber = api.addResource("gettlapartnumber");
        const getTlaPartNumberMethod = getTlaPartNumber.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(getTlaPartNumberMethod)

        // /api/buylevelpartnumber
        const buyLevelPartNumber = api.addResource("buylevelpartnumber");
        const buyLevelPartNumberMethod = buyLevelPartNumber.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(buyLevelPartNumberMethod)

        // /api/validateuser
        const validateUser = api.addResource("validateuser");
        const validateUserMethod = validateUser.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(validateUserMethod)

        // /api/createpsrinagile
        const createPsrInAgile = api.addResource("createpsrinagile");
        const createPsrInAgileMethod = createPsrInAgile.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(createPsrInAgileMethod)

        // /api/getpsrprojectname
        const getPsrProjectName = api.addResource("getpsrprojectname");
        const getPsrProjectNameMethod = getPsrProjectName.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(getPsrProjectNameMethod)

        // /api/getfileuploadurl
        const getFileUploadUrl = api.addResource("getfileuploadurl");
        const getFileUploadUrlMethod = getFileUploadUrl.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(getFileUploadUrlMethod)

        // /api/uploadfilesfroms3toagile
        const uploadFilesFroms3ToAgile = api.addResource("uploadfilesfroms3toagile");
        const uploadFilesFroms3ToAgileMethod = uploadFilesFroms3ToAgile.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(uploadFilesFroms3ToAgileMethod)

        // /api/deletefilefroms3
        const deleteFileFromS3 = api.addResource("deletefilefroms3");
        const deleteFileFromS3Method = deleteFileFromS3.addMethod('DELETE', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(deleteFileFromS3Method)

        // /api/assetupdateurl
        const assetUpdateUrl = api.addResource("assetupdateurl");
        const assetUpdateUrlMethod = assetUpdateUrl.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(assetUpdateUrlMethod)




         const myPermission = new LambdaIntegrationOnePermissionOnly(BackEndLambdaFunction, {
             restApi: LambdaRestApi

         })

        // Resource db
        const dbApi = LambdaRestApi.root.addResource('db');

        //resource db/get
        const dbGetApi = dbApi.addResource("get");

        //resource db/get/projecttype
        const dbGetProjectType = dbGetApi.addResource("projecttype");
        const dbGetProjectTypeMethod = dbGetProjectType.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetProjectTypeMethod)

        //resource db/get/siteimpact
        const dbGetSiteImpact = dbGetApi.addResource("siteimpact");
        const dbGetSiteImpactMethod = dbGetSiteImpact.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetSiteImpactMethod)

        //resource db/get/safetyrisk
        const dbGetSafetyRisk = dbGetApi.addResource("safetyrisk");
        const dbGetSafetyRiskMethod = dbGetSafetyRisk.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetSafetyRiskMethod)

        //resource db/get/deploymentstopped
        const dbGetDeploymentStopped = dbGetApi.addResource("deploymentstopped");
        const dbGetDeploymentStoppedMethod = dbGetDeploymentStopped.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetDeploymentStoppedMethod)

        //resource db/get/partrequired
        const dbGetPartRequired = dbGetApi.addResource("partrequired");
        const dbGetPartRequiredMethod = dbGetPartRequired.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetPartRequiredMethod)

        //resource db/get/tlanonconformance
        const dbGetTlanonConformance = dbGetApi.addResource("tlanonconformance");
        const dbGetTlanonConformanceMethod = dbGetTlanonConformance.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetTlanonConformanceMethod)

        //resource db/get/shipto
        const dbGetShipTo = dbGetApi.addResource("shipto");
        const dbGetShipToMethod = dbGetShipTo.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetShipToMethod)

        //resource db/get/helpsectioncontent
        const dbGetHelpSectionContent = dbGetApi.addResource("helpsectioncontent");
        const dbGetHelpSectionContentMethod = dbGetHelpSectionContent.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
       myPermission.bind1(dbGetHelpSectionContentMethod)

        //resource db/get/importantupdate
        const dbGetImportantUpdate = dbGetApi.addResource("importantupdate");
        const dbGetImportantUpdateMethod = dbGetImportantUpdate.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetImportantUpdateMethod)

        //resource db/get/psrcategory
        const dbGetPsrCategory = dbGetApi.addResource("psrcategory");
        const dbGetPsrCategoryMethod = dbGetPsrCategory.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetPsrCategoryMethod)

        //resource db/get/adminpsrsubcat
        const dbGetAdminPsrSubCat = dbGetApi.addResource("adminpsrsubcat");
        const dbGetAdminPsrSubCatMethod = dbGetAdminPsrSubCat.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetAdminPsrSubCatMethod)

        //resource db/get/adminpsrsubsubcat
        const dbGetAdminPsrSubSubCat = dbGetApi.addResource("adminpsrsubsubcat");
        const dbGetAdminPsrSubSubCatMethod = dbGetAdminPsrSubSubCat.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetAdminPsrSubSubCatMethod)

        //resource db/get/psrdashboardlinks
        const dbGetPsrDashboardLinks = dbGetApi.addResource("psrdashboardlinks");
        const dbGetPsrDashboardLinksMethod = dbGetPsrDashboardLinks.addMethod('GET', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetPsrDashboardLinksMethod)


        //resource db/get/psrsubcategory
        const dbGetPsrSubCategory = dbGetApi.addResource("psrsubcategory");
        const dbGetPsrSubCategoryMethod = dbGetPsrSubCategory.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetPsrSubCategoryMethod)

        //resource db/get/psrsubsubcategory
        const dbGetPsrSubSubCategory = dbGetApi.addResource("psrsubsubcategory");
        const dbGetPsrSubSubCategoryMethod = dbGetPsrSubSubCategory.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbGetPsrSubSubCategoryMethod)


        /*

        //resource db/createdatabase
        const dbCreateDatabase = dbApi.addResource("createdatabase");
        const dbCreateDatabaseMethod = dbCreateDatabase.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbCreateDatabaseMethod)

        //resource db/validateadmin
        const dbValidateAdmin = dbApi.addResource("validateadmin");
        const dbValidateAdminMethod = dbValidateAdmin.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbValidateAdminMethod)

         */

        //resource db/search
        const dbSearch = dbApi.addResource("search")

        /*
        //resource db/search/psrbyid
        const dbSearchPsrById = dbSearch.addResource("psrbyid");
        const dbSearchPsrByIdMethod = dbSearchPsrById.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbSearchPsrByIdMethod)

        //resource db/search/byusername
        const dbSearchByUsername = dbSearch.addResource("byusername");
        const dbSearchByUsernameMethod = dbSearchByUsername.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbSearchByUsernameMethod)

         */

        //resource db/search/userdetails
        const dbSearchUserdetails = dbSearch.addResource("userdetails");
        const dbSearchUserdetailsnMethod = dbSearchUserdetails.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbSearchUserdetailsnMethod)

        //resource db/search/latestsavedpsr
        const dbSearchLateStSavedPsr = dbSearch.addResource("latestsavedpsr");
        const dbSearchLateStSavedPsrMethod = dbSearchLateStSavedPsr.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbSearchLateStSavedPsrMethod)



        //resource db/upsert
        const dbUpsert = dbApi.addResource("upsert")

        //resource db/upsert/affitemnum
        const dbUpsertAffItemNum = dbUpsert.addResource("affitemnum");
        const dbUpsertAffItemNumMethod = dbUpsertAffItemNum.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertAffItemNumMethod)


        //resource db/upsert/tlaitemnum
        const dbUpsertTlaItemNum = dbUpsert.addResource("tlaitemnum");
        const dbUpsertTlaItemNumMethod =  dbUpsertTlaItemNum.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertTlaItemNumMethod)

        //resource db/upsert/userdetail
        const dbUpsertUserDetail = dbUpsert.addResource("userdetail");
        const ddbUpsertUserDetailMethod = dbUpsertUserDetail.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(ddbUpsertUserDetailMethod)

        //resource db/upsert/psrphotoupdate
        const dbUpsertPsrPhotoUpdate = dbUpsert.addResource("psrphotoupdate");
        const dbUpsertPsrPhotoUpdateMethod = dbUpsertPsrPhotoUpdate.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertPsrPhotoUpdateMethod)

        //resource db/upsert/importantupdate
        const dbUpsertImportantUpdate = dbUpsert.addResource("importantupdate");
        const dbUpsertImportantUpdateMethod = dbUpsertImportantUpdate.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertImportantUpdateMethod)

        //resource db/upsert/savedpsr
        const dbUpsertSavedpsr  = dbUpsert.addResource("savedpsr");
        const dbUpsertSavedpsrMethod = dbUpsertSavedpsr.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertSavedpsrMethod)

        //resource db/upsert/deploymentstopped
        const dbUpsertDeploymentStopped = dbUpsert.addResource("deploymentstopped");
        const dbUpsertDeploymentStoppedMethod = dbUpsertDeploymentStopped.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertDeploymentStoppedMethod)

        //resource db/upsert/partrequired
        const dbUpsertPartRequired = dbUpsert.addResource("partrequired");
        const dbUpsertPartRequiredMethod = dbUpsertPartRequired.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertPartRequiredMethod)

        //resource db/upsert/projecttype
        const dbUpsertProjectType = dbUpsert.addResource("projecttype");
        const dbUpsertProjectTypeMethod = dbUpsertProjectType.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertProjectTypeMethod)

        //resource db/upsert/psrcategory
        const dbUpsertPsrCategory = dbUpsert.addResource("psrcategory");
        const dbUpsertPsrCategoryMethod = dbUpsertPsrCategory.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertPsrCategoryMethod)

        //resource db/upsert/psrsubcategory
        const dbUpsertPsrSubCategory = dbUpsert.addResource("psrsubcategory");
        const dbUpsertPsrSubCategoryMethod = dbUpsertPsrSubCategory.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertPsrSubCategoryMethod)

        //resource db/upsert/psrsubsubcategory
        const dbUpsertPsrSubSubCategory = dbUpsert.addResource("psrsubsubcategory");
        const dbUpsertPsrSubSubCategoryMethod = dbUpsertPsrSubSubCategory.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertPsrSubSubCategoryMethod)

        //resource db/upsert/safetyrisk
        const dbUpsertSafetyRisk = dbUpsert.addResource("safetyrisk");
        const dbUpsertSafetyRiskMethod = dbUpsertSafetyRisk.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertSafetyRiskMethod)

        //resource db/upsert/shipto
        const dbUpsertShipTo = dbUpsert.addResource("shipto");
        const dbUpsertShipToMethod = dbUpsertShipTo.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertShipToMethod)

        //resource db/upsert/siteimpact
        const dbUpsertSiteImpact = dbUpsert.addResource("siteimpact");
        const dbUpsertSiteImpactMethod = dbUpsertSiteImpact.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertSiteImpactMethod)

        //resource db/upsert/tlanonconformancetiming
        const dbUpsertTlaNonConformanceTiming = dbUpsert.addResource("tlanonconformancetiming");
        const dbUpsertTlaNonConformanceTimingMethod = dbUpsertTlaNonConformanceTiming.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpsertTlaNonConformanceTimingMethod)

        //resource /db/upsert/dashboardlink
        const dbUpserDashboardLink = dbUpsert.addResource("dashboardlink");
        const dbUpserDashboardLinkMethod = dbUpserDashboardLink.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbUpserDashboardLinkMethod)




        //resource db/update
        const dbUpdate = dbApi.addResource("update")

        //resource db/update/contentforguidance
        const dbUpdateContentForGuidance = dbUpdate.addResource("contentforguidance");
        const ddbUpdateContentForGuidanceMethod = dbUpdateContentForGuidance.addMethod('POST', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(ddbUpdateContentForGuidanceMethod)



        //resource db/delete
        const dbDelete = dbApi.addResource("delete")

        //resource db/delete/photo
        const dbDeletePhoto = dbDelete.addResource("photo");
        const dbDeletePhotoMethod = dbDeletePhoto.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeletePhotoMethod)

        //resource db/delete/savedpsr
        const dbDeleteSavedPsr= dbDelete.addResource("savedpsr");
        const dbDeleteSavedPsrMethod = dbDeleteSavedPsr.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteSavedPsrMethod)

        //resource db/delete/deploymentstopped
        const dbDeleteDeploymentStopped = dbDelete.addResource("deploymentstopped");
        const dbDeleteDeploymentStoppedMethod = dbDeleteDeploymentStopped.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteDeploymentStoppedMethod)

        //resource db/delete/partrequired
        const dbDeletePartRequired = dbDelete.addResource("partrequired");
        const dbDeletePartRequiredMethod = dbDeletePartRequired.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeletePartRequiredMethod)

        //resource db/delete/projecttype
        const dbDeleteProjectType = dbDelete.addResource("projecttype");
        const dbDeleteProjectTypeMethod = dbDeleteProjectType.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteProjectTypeMethod)

        //resource db/delete/psrcategory
        const dbDeletePsrCategory = dbDelete.addResource("psrcategory");
        const dbDeletePsrCategoryMethod = dbDeletePsrCategory.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeletePsrCategoryMethod)

        //resource db/delete/psrsubcategory
        const dbDeletePsrSubCategory = dbDelete.addResource("psrsubcategory");
        const dbDeletePsrSubCategoryMethod = dbDeletePsrSubCategory.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeletePsrSubCategoryMethod)

        //resource db/delete/psrsubsubcategory
        const dbDeletePsrSubSubCategory = dbDelete.addResource("psrsubsubcategory");
        const dbDeletePsrSubSubCategoryMethod = dbDeletePsrSubSubCategory.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeletePsrSubSubCategoryMethod)

        //resource db/delete/safetyrisk
        const dbDeleteSafetyRisk = dbDelete.addResource("safetyrisk");
        const dbDeleteSafetyRiskMethod = dbDeleteSafetyRisk.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteSafetyRiskMethod)

        //resource db/delete/shipto
        const dbDeleteShipTo = dbDelete.addResource("shipto");
        const dbDeleteShipToMethod = dbDeleteShipTo.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteShipToMethod)

        //resource db/delete/siteimpact
        const dbDeleteSiteImpact = dbDelete.addResource("siteimpact");
        const dbDeleteSiteImpactMethod = dbDeleteSiteImpact.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteSiteImpactMethod)

        //resource db/delete/tlanonconformance
        const dbDeleteTlaNonConformance = dbDelete.addResource("tlanonconformance");
        const dbDeleteTlaNonConformanceMethod = dbDeleteTlaNonConformance.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteTlaNonConformanceMethod)

        //resource db/delete/userdetails
        const dbDeleteUserDetails = dbDelete.addResource("userdetails");
        const dbDeleteUserDetailsMethod = dbDeleteUserDetails.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteUserDetailsMethod)

        //resource db/delete/dashboardlink
        const dbDeleteDashboardLink = dbDelete.addResource("dashboardlink");
        const dbDeleteDashboardLinkMethod = dbDeleteDashboardLink.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteDashboardLinkMethod)

        //resource db/delete/importantupdate
        const dbDeleteImportantUpdate = dbDelete.addResource("importantupdate");
        const dbDeleteImportantUpdateMethod = dbDeleteImportantUpdate.addMethod('DELETE', new apigw.LambdaIntegration(BackEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        myPermission.bind1(dbDeleteImportantUpdateMethod)


        //resource oracle
        const oracleApi = LambdaRestApi.root.addResource('oracle');

        //resource oracle/deliverynumber
        const oracleDeliveryNumber = oracleApi.addResource("deliverynumber");
        const oracleDeliveryNumberMethod = oracleDeliveryNumber.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleDeliveryNumberMethod)

        //resource oracle/itemnumber
        const oracleItemNumber = oracleApi.addResource("itemnumber");
        const oracleItemNumberMethod = oracleItemNumber.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleItemNumberMethod)

        //resource oracle/destinationsite
        const oracleDestinationSite = oracleApi.addResource("destinationsite");
        const oracleDestinationSiteMethod = oracleDestinationSite.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleDestinationSiteMethod)

        //resource oracle/psrnumber
        const oraclePsrNumber = oracleApi.addResource("psrnumber");
        const oraclePsrNumberMethod = oraclePsrNumber.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oraclePsrNumberMethod)

        //resource oracle/searchloadnumber
        const oracleSearchLoadNumber = oracleApi.addResource("searchloadnumber");
        const oracleSearchLoadNumberMethod = oracleSearchLoadNumber.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleSearchLoadNumberMethod)

        //resource oracle/filterdata
        const oracleFilterData = oracleApi.addResource("filterdata");
        const oracleFilterDataMethod = oracleFilterData.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleFilterDataMethod)

        //resource oracle/productline
        const oracleProductLine = oracleApi.addResource("productline");
        const oracleProductLineMethod = oracleProductLine.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleProductLineMethod)

        //resource oracle/itemdesc
        const oracleItemDesc = oracleApi.addResource("itemdesc");
        const oracleItemDescMethod = oracleItemDesc.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleItemDescMethod)

        //resource oracle/shipsstatus
        const oracleShipsStatus = oracleApi.addResource("shipsstatus");
        const oracleShipsStatusMethod = oracleShipsStatus.addMethod('GET', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleShipsStatusMethod)

        //resource oracle/receiptsstatus
        const oracleReceiptsStatus = oracleApi.addResource("receiptsstatus");
        const oracleReceiptStatusMethod = oracleReceiptsStatus.addMethod('GET', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleReceiptStatusMethod)



        //resource oracle/submitdata
        const oracleSubmitData = oracleApi.addResource("submitdata");
        const oracleSubmitDataMethod = oracleSubmitData.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleSubmitDataMethod)

        //resource oracle/dailygraphbysite
        const oracleDailyGraphBySite = oracleApi.addResource("dailygraphbysite");
        const oracleDailyGraphBySIteMethod = oracleDailyGraphBySite.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleDailyGraphBySIteMethod)

        //resource oracle/weeklygraphbysite
        const oracleWeeklyGraphBySite = oracleApi.addResource("weeklygraphbysite");
        const oracleWeeklyGraphBySiteMethod = oracleWeeklyGraphBySite.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleWeeklyGraphBySiteMethod)


        //resource oracle/submitvalidate
        const oracleSubmitValidate = oracleApi.addResource("submitvalidate");
        const oracleSubmitValidateMethod = oracleSubmitValidate.addMethod('POST', new apigw.LambdaIntegration(FrontEndLambdaFunction), {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer: {
                authorizerId: authorizer.ref
            }
        })
        frontendPermission.bind1(oracleSubmitValidateMethod)













































        /*
                const frontEndVersion = new aws_lambda.Version(this, 'MyVersion', {
                    lambda: FrontEndLambdaFunction,
                })
        */
        /*
        this.hydraResources = new HydraTestRunResources(this, 'HydraTestRunResources', {
            hydraEnvironment: props.env.hydraEnvironment,
            hydraAsset: {
                targetPackage: BrazilPackage.fromString('BT101Kengnbpiv2LambdaTests-1.0')
            },
        });

        addFunction.grantInvoke(this.hydraResources.invocationRole);
        subtractFunction.grantInvoke(this.hydraResources.invocationRole);
        multiplyFunction.grantInvoke(this.hydraResources.invocationRole);
        divideFunction.grantInvoke(this.hydraResources.invocationRole);

        */
    }
}