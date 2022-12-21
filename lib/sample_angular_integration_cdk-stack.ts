import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SampleAngularIntegrationCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'SampleAngularIntegrationCdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}

import {
  BrazilPackage,
  SoftwareType,
  DependencyModel,
  BakeTimeApprovalWorkflowStep,
  CodeReviewVerificationApprovalWorkflowStep,
  DeploymentEnvironmentFactory,
  DeploymentPipeline, DogmaTagsOptions,
  Platform,
  Stage, DeploymentStack
} from '@amzn/pipelines'

import {App} from 'aws-cdk-lib';


import {websiteStack} from "./static-website-stack";
// import {cognitoStack} from "./stacks/cognito";
import {FrontEndLambdaStack} from "./front-end-lambda-stack";

import {amamzonRDEInfrastructureCoreStack} from "./Infrastructure-core-stak";
import {amazonRDEWaf} from "./waf";
import {cognitoStack} from "./cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {AuroraDBStack} from "./aurora-postgres-stack";


// Set up your CDK App
const app = new App();

const region = 'us-east-2';

// Accounts variables
const devAccount = '424975656753';
const uatAccount = '281368221808';
const prodAccount = '359643179693';
const pipelineId = '4302582';

const applicationAccount = uatAccount;

// VPC data
const prodVpcId = 'vpc-09d4424f81c6a0ed8'
const uatVpcId = 'vpc-0606c716ca500f45e'
const uatSubnetIds = ['subnet-062d7c514d55bf8be','subnet-0be6c255a5d6cd6bc','subnet-08d54de4443be78bb'];
const prodSubnetIds = ['subnet-044b409b2df67c79f','subnet-056c786925355fe59','subnet-00edce0258b0accbf'];
const uatAvailabilityZones = ['us-east-2a', 'us-east-2b', 'us-east-2c'];
const prodAvailabilityZones = ['us-east-2a', 'us-east-2b', 'us-east-2c'];
const listOfUatPrivateSubnetsCdrBlock = ['10.18.1.0/27', '10.18.1.32/27', '10.18.1.64/27']
const listOfProdPrivateSubnetsCdrBlock = ['10.18.0.0/27', '10.18.0.32/27', '10.18.0.64/27']

//package names
//const ui_package_name = 'AmazonPSRimprovePKG_CDK2';
const prod_ui_package_name = 'AmazonPSR_UI_Prod';
const uat_ui_package_name = 'AmazonPSRimprovePKG_CDK_UAT';
// const front_end_lambda_function_package_name = 'AmazonPSRImprovenmentLambdaPKG_ForCDK';
const prod_frontend_lambda_function_package_name = 'AmazonPSR_Lambda_Prod';
const uat_frontend_lambda_function_package_name = 'AmazonPSRImprovenmentLambdaPKG_CDK_UAT';
const prod_backend_lambda_function_package_name = 'AmazonPSR_IntermediateDB_Prod';
const uat_backend_lambda_function_package_name = 'AmazonPSRImprovenmentIntermediateDBPKG';
const lambda_layer_package_name = 'AmazonPSRImprovenmentLambdaLayerPKG_ForCDK';


// Envirionment variables
const API_ENDPOINT_URL_UAT = 'https://plmintuat.robotics.a2z.com:443/Agile/extension/ValidateAndCreatePSRWebservice';
const API_ENDPOINT_URL_PROD = 'https://plmint.robotics.a2z.com:443/Agile/extension/ValidateAndCreatePSRWebservice';
const PSR_AGILE_FILE_UPLOAD_URL_UAT = 'https://plmintuat.robotics.a2z.com:443/CoreService/services/Attachment';
const PSR_AGILE_FILE_UPLOAD_URL_PROD = 'https://plmint.robotics.a2z.com:443/CoreService/services/Attachment';
const ORACLE_VALIDATE_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/uservalidate/user/';
const ORACLE_SEARCH_LOADNUMBER_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/loaddetails/load/';
const ORACLE_SEARCH_DELIVERYNUMBER_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/deliverydetails/delivery/';
const ORACLE_SEARCH_DESTINATIONCODE_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/destnum/warehouse/';
const ORACLE_SEARCH_ITEMNUMBER_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/itemnum/item/';
const ORACLE_SEARCH_PSRNUMBER_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/psrnum/psr/';
const ORCALE_SEARCH_PRODUCTLINE_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/productline/prdline/';
const ORACLE_SEARCH_ITEMDESCRIPTION_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/itemdesc/desc/';
const ORACLE_FILTER_DATA_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/getdata/shipinfo/';
const ORACLE_FILTER_SHIPSTATUS_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/shipstatus/shipstat/ALL';
const ORACLE_SEARCH_RECEIPTSTATUS_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/rcvstatus/rcvstat/ALL';
const ORACLE_DAILY_GRAPH_SITECODE_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/dailygraphs_with_site/daily_site/';
const ORACLE_WEEKLY_GRAPH_SITECODE_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/weeklygraphs_with_site/weekly_site/';
const ORACLE_SUBMIT_DATA_UAT = 'https://tstords.robotics.a2z.com/ords/xxar/rest-v7/updrctqty/';
const ORACLE_VALIDATE_SUBMIT_UAT = 'https://tstords.robotics.a2z.com/tords/xxar/duplicate_data/duplicate/';
const ORACLE_VALIDATE_PROD = 'https://ords.robotics.a2z.com/ords/xxar/uservalidate/user/';
const ORACLE_SEARCH_LOADNUMBER_PROD = 'https://ords.robotics.a2z.com/ords/xxar/loaddetails/load/';
const ORACLE_SEARCH_DELIVERYNUMBER_PROD = 'https://ords.robotics.a2z.com/ords/xxar/deliverydetails/delivery/';
const ORACLE_SEARCH_DESTINATIONCODE_PROD = 'https://ords.robotics.a2z.com/ords/xxar/destnum/warehouse/';
const ORACLE_SEARCH_ITEMNUMBER_PROD = 'https://ords.robotics.a2z.com/ords/xxar/itemnum/item/';
const ORACLE_SEARCH_PSRNUMBER_PROD = 'https://ords.robotics.a2z.com/ords/xxar/psrnum/psr/';
const ORCALE_SEARCH_PRODUCTLINE_PROD = 'https://ords.robotics.a2z.com/ords/xxar/productline/prdline/';
const ORACLE_SEARCH_ITEMDESCRIPTION_PROD = 'https://ords.robotics.a2z.com/ords/xxar/itemdesc/desc/';
const ORACLE_FILTER_DATA_PROD = 'https://ords.robotics.a2z.com/ords/xxar/getdata/shipinfo/';
const ORACLE_FILTER_SHIPSTATUS_PROD = 'https://ords.robotics.a2z.com/ords/xxar/shipstatus/shipstat/ALL';
const ORACLE_SEARCH_RECEIPTSTATUS_PROD = 'https://ords.robotics.a2z.com/ords/xxar/rcvstatus/rcvstat/ALL';
const ORACLE_DAILY_GRAPH_SITECODE_PROD = 'https://ords.robotics.a2z.com/ords/xxar/dailygraphs_with_site/daily_site/';
const ORACLE_WEEKLY_GRAPH_SITECODE_PROD = 'https://ords.robotics.a2z.com/ords/xxar/weeklygraphs_with_site/weekly_site/';
const ORACLE_SUBMIT_DATA_PROD = 'https://ords.robotics.a2z.com/ords/xxar/rest-v7/updrctqty/';
const ORACLE_VALIDATE_SUBMIT_PROD = 'https://ords.robotics.a2z.com/ords/xxar/duplicate_data/duplicate/';
const DB_SECRET_NAME_UAT = 'uatAuroraClusterCredentials';
const DB_SECRET_NAME_PROD = 'prodAuroraClusterCredentials';


// Frontend lambda function SG parameters
const agilePLMCidrIPUat = "10.16.8.0/25"
const agilePLMCidrIPProd = "10.16.4.0/22"
const oracleCidrIPUat = "10.16.8.0/25"
const oracleCidrIPProd = "10.16.4.0/22"
const agilePLMEgressPortUat = 443
const agilePLMEgressPortProd = 443
const oracleEgressPortUat = 443
const oracleEgressPortProd = 443

// Domain name per envionment
const devDomainName = 'app.psrscandev.robotics.a2z.com';
const integDomainName = 'app.psrscanuat.robotics.a2z.com';
const prodDomainName = 'app.psrscan.robotics.a2z.com';

let applicationDomainName = integDomainName;

// Cognito parameters
const uatCognitoCertificationARN = 'arn:aws:acm:us-east-1:359643179693:certificate/ad20217f-fcde-491e-b0a1-a3ce7a3e1d98';
const prodCognitoCertificationARN = 'arn:aws:acm:us-east-1:359643179693:certificate/ad20217f-fcde-491e-b0a1-a3ce7a3e1d98';
const uatCognitoDomainName = 'auth.psrscan.robotics.a2z.com';
const prodCognitoDomainNAme = 'auth.psrscan.robotics.a2z.com';
const UatUserPoolArn = 'arn:aws:cognito-idp:us-east-2:281368221808:userpool/us-east-2_zIJtJAJ6S'
const prodUserPoolArn = 'arn:aws:cognito-idp:us-east-2:359643179693:userpool/us-east-2_888yX1xsV'

// Lambda autorizer url
const uatLambdaAuthorizerUrl = `arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:281368221808:function:amazonRDEImproveCDK1-Fron-Imagelambdafunction68736-t602aDSz9xKG/invocations`;
const prodLambdaAuthorizerUrl = `arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:359643179693:function:amazonRDEImproveCDK1-Fron-Imagelambdafunction68736-SKFsDL8m1RcR/invocations`;



const pipeline = new DeploymentPipeline(app, 'Pipeline', {
  account: uatAccount,
  pipelineName: 'AmazonRDEImprovement',
  //versionSet: 'AmazonRDEImprovement/development', // The version set you created
  versionSet: {
    name: 'AmazonRDEImprovement/development', // The version set you created
    dependencyModel: DependencyModel.BRAZIL,
  },
  versionSetPlatform: Platform.AL2_X86_64,
  trackingVersionSet: 'live', // Or any other version set you prefer
  bindleGuid: 'amzn1.bindle.resource.bu2345z74uhhz5fkxe2q',
  description: 'Simple CDK Pipeline',
  pipelineId: pipelineId,
  selfMutate: true,
});

[
    `${prod_ui_package_name}-1.0`,
    `${uat_ui_package_name}-1.0`,
    `${prod_frontend_lambda_function_package_name}-1.0`,
    `${uat_frontend_lambda_function_package_name}-1.0`,
    `${prod_backend_lambda_function_package_name}-1.0`,
    `${uat_backend_lambda_function_package_name}-1.0`,
    `${lambda_layer_package_name}-1.0`
].map(pkg => pipeline.addPackageToAutobuild(BrazilPackage.fromString(pkg)));



function buildStack(stageName: string) {
 // const environment = DeploymentEnvironmentFactory.fromAccountAndRegion(account, region, `${pipelineId}`)

  let isprod = false;
  let account = "";
  let vpcsubnets : string[] = [];
  let vpcID = "";
  let API_ENDPOINT_URL = "";
  let PSR_AGILE_FILE_UPLOAD_URL = "";
  let vpcavailabiltyzones: string[];
  let cognitoCertificationARN: string;
  let cognitoDomainName: string;
  let lambdaAuthorizerUrl: string;
  let uiPackageName: string;
  let frontendLambdaFunctionPackageName: string;
  let backendLambdaFunctionPackageName: string;
  let AgilePLMCidrIP = ""
  let AgilePLMSGPort = 443
  let OracleCidrIP = ""
  let OraclePort = 443
  let ListOfPrivateSubnetsCdrBlock = []
  let oracle_Validate = ""
  let oracle_SearchLoadNumber = ""
  let oracle_SearchDeliveryNumber = ""
  let oracle_SearchDestinationCode = ""
  let oracle_SearchItemNumber = ""
  let oracle_SearchPsrNumber = ""
  let oracle_SearchProductLine = ""
  let oracle_SearchItemDescription = ""
  let oracle_FilterData = ""
  let oracle_FilterShipStatus = ""
  let oracle_SearchReceiptStatus = ""
  let oracle_DailyGraphSiteCode = ""
  let oracle_WeeklyGraphSiteCode = ""
  let oracle_SubmitData = ""
  let oracle_ValidateSubmit = ""
  let DB_SecretName = ""



  if(stageName == "prod") {
    isprod = false
    account = prodAccount
    applicationDomainName = prodDomainName
    vpcsubnets = prodSubnetIds
    vpcavailabiltyzones = prodAvailabilityZones
    vpcID = prodVpcId
    API_ENDPOINT_URL = API_ENDPOINT_URL_PROD
    PSR_AGILE_FILE_UPLOAD_URL = PSR_AGILE_FILE_UPLOAD_URL_PROD
    cognitoCertificationARN = prodCognitoCertificationARN
    cognitoDomainName = prodCognitoDomainNAme
    lambdaAuthorizerUrl = prodLambdaAuthorizerUrl
    uiPackageName = prod_ui_package_name
    frontendLambdaFunctionPackageName = prod_frontend_lambda_function_package_name
    backendLambdaFunctionPackageName = prod_backend_lambda_function_package_name
    AgilePLMCidrIP = agilePLMCidrIPProd
    AgilePLMSGPort = agilePLMEgressPortProd
    OracleCidrIP = oracleCidrIPProd
    OraclePort = oracleEgressPortProd
    ListOfPrivateSubnetsCdrBlock = listOfProdPrivateSubnetsCdrBlock
    oracle_Validate = ORACLE_VALIDATE_PROD
    oracle_SearchLoadNumber = ORACLE_SEARCH_LOADNUMBER_PROD
    oracle_SearchDeliveryNumber = ORACLE_SEARCH_DELIVERYNUMBER_PROD
    oracle_SearchDestinationCode = ORACLE_SEARCH_DESTINATIONCODE_PROD
    oracle_SearchItemNumber = ORACLE_SEARCH_ITEMNUMBER_PROD
    oracle_SearchPsrNumber = ORACLE_SEARCH_PSRNUMBER_PROD
    oracle_SearchProductLine = ORCALE_SEARCH_PRODUCTLINE_PROD
    oracle_SearchItemDescription = ORACLE_SEARCH_ITEMDESCRIPTION_PROD
    oracle_FilterData = ORACLE_FILTER_DATA_PROD
    oracle_FilterShipStatus = ORACLE_FILTER_SHIPSTATUS_PROD
    oracle_SearchReceiptStatus = ORACLE_SEARCH_RECEIPTSTATUS_PROD
    oracle_DailyGraphSiteCode = ORACLE_DAILY_GRAPH_SITECODE_PROD
    oracle_WeeklyGraphSiteCode = ORACLE_WEEKLY_GRAPH_SITECODE_PROD
    oracle_SubmitData = ORACLE_SUBMIT_DATA_PROD
    oracle_ValidateSubmit = ORACLE_VALIDATE_SUBMIT_PROD
    DB_SecretName = DB_SECRET_NAME_PROD
  }
  else {
    isprod = false
    account = uatAccount
    applicationDomainName = integDomainName
    vpcsubnets = uatSubnetIds
    vpcavailabiltyzones = uatAvailabilityZones
    vpcID = uatVpcId
    API_ENDPOINT_URL = API_ENDPOINT_URL_UAT
    PSR_AGILE_FILE_UPLOAD_URL = PSR_AGILE_FILE_UPLOAD_URL_UAT
    cognitoCertificationARN = uatCognitoCertificationARN
    cognitoDomainName = uatCognitoDomainName
    lambdaAuthorizerUrl = uatLambdaAuthorizerUrl
    uiPackageName = uat_ui_package_name
    frontendLambdaFunctionPackageName = uat_frontend_lambda_function_package_name
    backendLambdaFunctionPackageName = uat_backend_lambda_function_package_name
    AgilePLMCidrIP = agilePLMCidrIPUat
    AgilePLMSGPort = agilePLMEgressPortUat
    OracleCidrIP = oracleCidrIPUat
    OraclePort = oracleEgressPortUat
    ListOfPrivateSubnetsCdrBlock = listOfUatPrivateSubnetsCdrBlock
    oracle_Validate = ORACLE_VALIDATE_UAT
    oracle_SearchLoadNumber = ORACLE_SEARCH_LOADNUMBER_UAT
    oracle_SearchDeliveryNumber = ORACLE_SEARCH_DELIVERYNUMBER_UAT
    oracle_SearchDestinationCode = ORACLE_SEARCH_DESTINATIONCODE_UAT
    oracle_SearchItemNumber = ORACLE_SEARCH_ITEMNUMBER_UAT
    oracle_SearchPsrNumber = ORACLE_SEARCH_PSRNUMBER_UAT
    oracle_SearchProductLine = ORCALE_SEARCH_PRODUCTLINE_UAT
    oracle_SearchItemDescription = ORACLE_SEARCH_ITEMDESCRIPTION_UAT
    oracle_FilterData = ORACLE_FILTER_DATA_UAT
    oracle_FilterShipStatus = ORACLE_FILTER_SHIPSTATUS_UAT
    oracle_SearchReceiptStatus = ORACLE_SEARCH_RECEIPTSTATUS_UAT
    oracle_DailyGraphSiteCode = ORACLE_DAILY_GRAPH_SITECODE_UAT
    oracle_WeeklyGraphSiteCode = ORACLE_WEEKLY_GRAPH_SITECODE_UAT
    oracle_SubmitData = ORACLE_SUBMIT_DATA_UAT
    oracle_ValidateSubmit = ORACLE_VALIDATE_SUBMIT_UAT
    DB_SecretName = DB_SECRET_NAME_UAT
  }
/*
  const projectVPC = ec2.Vpc.fromVpcAttributes(app, 'project-vpc', {
    vpcId: vpcID,
    availabilityZones: ['us-east-2-a', 'us-east-2-b', 'us-east-2-c'],
    privateSubnetIds: vpcsubnets
    //privateSubnetIds: ['subnet-044b409b2df67c79f','subnet-056c786925355fe59','subnet-00edce0258b0accbf'],
    //publicSubnetIds: ['subnet-0f06f88f637b57a74']

  });

 */


  const stage = pipeline.addStage(stageName, {isProd: isprod});

  const deploymentGroup = stage.addDeploymentGroup({
    name: `${stageName}Application`
  });

  const deploymentProps = {
    env: pipeline.deploymentEnvironmentFor(account, region),
    softwareType: SoftwareType.INFRASTRUCTURE,
    stage: stageName
  };

  const deploymentUsEast1Props = {
    env: pipeline.deploymentEnvironmentFor(account, 'us-east-1'),
    softwareType: SoftwareType.INFRASTRUCTURE,
    stage: stageName
  };



  const infrastructureStack = new amamzonRDEInfrastructureCoreStack(app, `amazonRDEImproveCDK-Infra-Core-${stageName}`, {
    ...deploymentProps,

  });

  deploymentGroup.addStacks(infrastructureStack);







  const websitestack = new websiteStack(app, `amazonRDEImproveCDK1-staticwebsite-${stageName}`, {

    ...deploymentProps,
      domainName: applicationDomainName,
    packageName: uiPackageName

    //domainName: prodDomainName

  });
  deploymentGroup.addStacks(websitestack);


  const FrontEndLambdastack = new FrontEndLambdaStack(app, `amazonRDEImproveCDK1-FrontEndLambda-${stageName}`, {
    ...deploymentProps,
    vpcID: vpcID,
    vpcSubnets: vpcsubnets,
    availabiltyZone: vpcavailabiltyzones,
    apiEndPointUrl: API_ENDPOINT_URL,
    psrAgileFileUploadUrl: PSR_AGILE_FILE_UPLOAD_URL,
    frontendlambdaFunctionPackageName: frontendLambdaFunctionPackageName,
    backendlambdaFunctionPackageName: backendLambdaFunctionPackageName,
    lambdaLayerPackageName: lambda_layer_package_name,
    //authorizerUrl: lambdaAuthorizerUrl
    region: region,
    awsaccountid: account,
    agilePLMCidrIP: AgilePLMCidrIP,
    agilePLMEgressPort: AgilePLMSGPort,
    oracleCidrIP: OracleCidrIP,
    oraclegressPort: OraclePort,
    listOfPrivateSubnetsCdrBlock: ListOfPrivateSubnetsCdrBlock,
    uatUserPoolArn: UatUserPoolArn,
    prodUserPoolArn: prodUserPoolArn,
    oracleValidate: oracle_Validate,
    oracleSearchLoadNumber: oracle_SearchLoadNumber,
    oracleSearchDeliveryNumber: oracle_SearchDeliveryNumber,
    oracleSearchDestinationCode: oracle_SearchDestinationCode,
    oracleSearchItemNumber: oracle_SearchItemNumber,
    oracleSearchPsrNumber: oracle_SearchPsrNumber,
    oracleSearchProductLine: oracle_SearchProductLine,
    oracleSearchItemDescription: oracle_SearchItemDescription,
    oracleFilterData: oracle_FilterData,
    oracleFilterShipStatus: oracle_FilterShipStatus,
    oracleSearchReceiptStatus: oracle_SearchReceiptStatus,
    oracleDailyGraphSiteCode: oracle_DailyGraphSiteCode,
    oracleWeeklyGraphSiteCode: oracle_WeeklyGraphSiteCode,
    oracleSubmitData: oracle_SubmitData,
    oracleValidateSubmit: oracle_ValidateSubmit,
    dbSecretName: DB_SecretName
    //domainName: prodDomainName
  });

  deploymentGroup.addStacks(FrontEndLambdastack);

  // let CognitoStack: DeploymentStack
  if (stageName == "prod") {
    const CognitoStack = new cognitoStack(app, `amazonRDEImproveCDK-Cognito-${stageName}`, {
      ...deploymentProps,
      certificateArn: cognitoCertificationARN,
      domainName: cognitoDomainName

    });

    deploymentGroup.addStacks(CognitoStack);
    FrontEndLambdastack.addDependency(CognitoStack,"cognito userpool")
  }


  const projectWaf = new amazonRDEWaf(app, `AmazonRDEWaf-${stageName}`, {
    ...deploymentUsEast1Props,
  });
  deploymentGroup.addStacks(projectWaf);

  const auroraDB = new AuroraDBStack(app,`AmazonRDEAuroraDB-${stageName}`, {
    ...deploymentProps,
    vpcId: vpcID,
    vpcSubnets: vpcsubnets,
    availabiltyZones: vpcavailabiltyzones,
    engine: "postgresql",
    subnetIds: vpcsubnets
  });

  deploymentGroup.addStacks(auroraDB);
  auroraDB.addDependency(FrontEndLambdastack,"")
}



// Build uat Environment Stage
//buildStack("uat");


// Build Prod Environment Stage
buildStack("prod");
