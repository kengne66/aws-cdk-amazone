import * as cdk from 'aws-cdk-lib';
import {Construct} from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as S3 from "aws-cdk-lib/aws-s3";
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
// import {staticwebsiteProps} from "./static-website-stack";
import {DeploymentStackProps, DeploymentStack} from "@amzn/pipelines";
import {CfnOutput} from "aws-cdk-lib";

export interface cognitoProps extends DeploymentStackProps {
    readonly stage: string;
    readonly certificateArn: string
    readonly domainName: string
}


export class cognitoStack  extends DeploymentStack {
    constructor(scope: Construct, id: string, readonly props: cognitoProps) {
        super(scope, id, props);


        // Paramater are store in us-east-2 on dev environment. Please change the ParamaterName reference accordingly
        const CognitoClientIDToken = ssm.StringParameter.valueForStringParameter(
            this, 'amazonRDECognitoClientID', 1);
        const CognitoAuthorizeUrlToken = ssm.StringParameter.valueForStringParameter(
            this, 'amazonRDECognitoAuthorizeUrl', 1);
        const amazonRDECognitoJwksToken = ssm.StringParameter.valueForStringParameter(
            this, 'amazonRDECognitoJwks', 1);
        const amazonRDECognitoOidc_issuerToken = ssm.StringParameter.valueForStringParameter(
            this, 'amazonRDECognitoOidc_issuer', 1);
        const amazonRDECognitoUserInfoUrlToken = ssm.StringParameter.valueForStringParameter(
            this, 'amazonRDECognitoUserInfoUrl', 1);
        const anazonRDECognitoTokenToken = ssm.StringParameter.valueForStringParameter(
            this, 'anazonRDECognitoToken', 1);
        const amazonRDEDomain_Name = ssm.StringParameter.valueForStringParameter(
            this, 'amazonRDEDomain_Name', 1);
        const amazonidpname = ssm.StringParameter.valueForStringParameter(
            this, 'amazonidpname', 1);

        const userpool = new cognito.UserPool(this, `${props.stage}-userPool`, {
            userPoolName: `${props.stage}-user-pool`,
            removalPolicy: cdk.RemovalPolicy.DESTROY, //Policy to apply when the user pool is removed from the stack.
            selfSignUpEnabled: false,        //Whether self sign up should be enabled. default: { username: true }
            signInAliases: {email: true}, //Methods in which a user registers or signs in to a user pool.
            autoVerify: {email: true},  //Attributes which Cognito will look to verify automatically upon user sign up.
            passwordPolicy: {
                minLength: 6,
                requireLowercase: false,
                requireDigits: false,
                requireUppercase: false,
                requireSymbols: false,
            }, //password for signup in userpool
            //accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, //How will a user be able to recover their account?
        })


        const idprovider = new cognito.CfnUserPoolIdentityProvider(this, 'OIDC', {
            userPoolId : userpool.userPoolId,
            providerName: `psr${props.stage}identityprovider001`, //providerName: amazonidpname.toString(),
            providerDetails: {
                client_id: CognitoClientIDToken.toString(),
                //client_secret: clientSecret.secretValue,
                attributes_request_method: 'GET',
                oidc_issuer: amazonRDECognitoOidc_issuerToken.toString(),
                authorize_scopes: 'openid user:email',
                authorize_url: CognitoAuthorizeUrlToken.toString(), //`${oidcApiUrl}authorize`,
                token_url: anazonRDECognitoTokenToken.toString(), //`${oidcApiUrl}token`,
                attributes_url: amazonRDECognitoUserInfoUrlToken.toString(), //`${oidcApiUrl}userinfo`,
                jwks_uri: amazonRDECognitoJwksToken.toString(), //`${oidcApiUrl}.well-known/jwks.json`,
            },
            providerType: 'OIDC',
            idpIdentifiers : ['email'],
            attributeMapping: {
                username: 'sub',
                email: 'email',
                //email_verified: 'email_verified',
            },
        });

        //const userPoolClient = new cognito.UserPoolClient(this, 'devdemo-userpool-client', {
        const userPoolClient = new cognito.UserPoolClient(this,  `${this.props.stage}-userpool-client`, {
            userPool : userpool,
            enableTokenRevocation : true, // Enable token revocation for this client.
            preventUserExistenceErrors : true, // Cognito returns a UserNotFoundException exception when the user does not exist in the user pool (false), or whether it returns another type of error that doesn't reveal the user's absence.
            authFlows: {
                //adminUserPassword: true,
                //userPassword: true, //Non-SRP authentication flow; USERNAME and PASSWORD are passed directly
                //custom: true,
                userSrp: true, //authenticates the user without transmitting a password, using the Secure Remote Password protocol
            }, // The set of OAuth authentication flows to enable on the client
            oAuth: {
                scopes:[
                    // cognito.OAuthScope.COGNITO_ADMIN,
                    // cognito.OAuthScope.PHONE,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    // cognito.OAuthScope.PROFILE,
                ], // OAuth settings for this client to interact with the app.
                flows: {
                    authorizationCodeGrant: true,
                    implicitCodeGrant: true,
                },
                callbackUrls: [
                    'https://google.com',
                    //amazonRDEapp_url.toString(),
                ],
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            idTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(30),
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
                cognito.UserPoolClientIdentityProvider.custom(idprovider.providerName)
            ],
        });

        // Custom Domain CertficateARN
        //const certificateArn = 'arn:aws:acm:us-east-1:359643179693:certificate/ad20217f-fcde-491e-b0a1-a3ce7a3e1d98';

        // Custom Domain Certficate
        const domainCert = certificatemanager.Certificate.fromCertificateArn(this, 'domainCert', this.props.certificateArn);

        //Custom domain code
        userpool.addDomain('CustomDomain',{
            customDomain: {
                certificate: domainCert ,
                //domainName: 'auth.psrscan.robotics.a2z.com',
                domainName: this.props.domainName
            },
        });


        new CfnOutput(this, 'region', {value: cdk.Stack.of(this).region});
        new CfnOutput(this, `${this.props.stage}userPoolId`, {
            exportName: `${this.props.stage}userPoolId`,
            value: userpool.userPoolId
        });
        new CfnOutput(this, `${this.props.stage}userPoolArn`, {
            exportName: `${this.props.stage}userPoolArn`,
            value: userpool.userPoolArn
        });

        new CfnOutput(this, `${this.props.stage}userPoolClientId`, {
            exportName: `${this.props.stage}userPoolClientId`,
            value: userPoolClient.userPoolClientId
        });



    }
}
