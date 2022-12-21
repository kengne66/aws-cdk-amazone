import {Construct} from "constructs";
import {BrazilPackage, DeploymentStack, DeploymentStackProps, LambdaAsset, BrazilPackageProps,BATSStaticArtifactProvider, BrazilPackageLambdaCode} from "@amzn/pipelines";
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import {CopyMode, IStaticWebsiteDistributionProps, IArtifactCopyConfiguration, StaticWebsite } from "@amzn/cdk-bones";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {PolicyStatement} from "aws-cdk-lib/aws-iam";
import {CloudFrontAllowedMethods} from "aws-cdk-lib/aws-cloudfront";

import * as path from "path"
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import {CfnOutput} from "aws-cdk-lib";

import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';


const fs = require('fs')

export interface staticwebsiteProps1 extends DeploymentStackProps {
    readonly stage: string;
    readonly domainName: string;
    readonly packageName: string
}

export class websiteStack extends DeploymentStack {
    constructor(scope: Construct, id: string, readonly props: staticwebsiteProps1) {
        super(scope, id, props);

        const provider = new BATSStaticArtifactProvider(this, {
            // NOTE: Your website assets package name goes in the string below
            brazilPackage: BrazilPackage.fromString(this.props.packageName),
            // The value below can be anything under 22 characters, but should not be duplicated
            // between assets
            componentName: 'CloudFrontAssets',
            // This will be the directory in your lambda-transform.yml
            subFolder: 'artifacts/',
        });
       // Finally, build the StaticWebsite construct
        const webProps = provider.websiteCopyConfiguration();
        webProps.settings = {
            // we need to add this attribute to force deploy to our s3 Origin.
            // without it the deployment bucket artifacts never copy over to the Origin.
            updatingDate: Date.now().toString()
        };

        /*
        const myHostedZone: route53.HostedZone

        new acm.DnsValidatedCertificate(this, 'CrossRegionCertificate', {
            domainName: props.domainName,
            hostedZone: myHostedZone,
            region: 'us-east-1',
        });

        const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: this.props.domainName});

        const myCertificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
            domainName: '*.psrscan.robotics.a2z.com',
            hostedZone: zone,
            region: 'us-east-1', // Cloudfront only checks this region for certificates.
        });


        new CfnOutput(this, 'Certificate', { value: myCertificate.certificateArn });
        */

        // Finally, build the StaticWebsite construct
        new StaticWebsite(this, 'Website', {
            /*
            dns: {
                hostedZoneName: props.domainName,
            },
            */
            website: {
                artifactCopyConfiguration: webProps,

                    /*
                    injectedArtifacts: [
                        {
                            path: "/error/403.html",
                            content: forbiddenErrorFile
                        }
                    ],
                    */

                behaviors: [
                    {
                        isDefaultBehavior: true,
                        allowedMethods: CloudFrontAllowedMethods.GET_HEAD,
                        /*
                        trustedSigners: [
                            "076938169600"
                        ]
                        */


                    }
                ],
                invalidationKey: this.packagingAggregateIdParameter.value,
                invalidationPaths: ["/*"],
                singlePageWebapp: true,
                additionalErrorHandlers: [
                    {
                        errorCode: 403,
                        responseCode: 403,
                        responsePagePath: "/error/403.html"
                    }
                ]
            },
        });


    }
}