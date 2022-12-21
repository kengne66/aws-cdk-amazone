import * as cdk from 'aws-cdk-lib';
import {DeploymentStackProps, DeploymentStack, DogmaTagsOptions, SoftwareType} from "@amzn/pipelines";
import {IVpc} from "aws-cdk-lib/aws-ec2";
import {CfnWebACL} from 'aws-cdk-lib/aws-wafv2';
import {Construct} from "constructs";

export interface WafStackProps extends  DeploymentStackProps {
    readonly stage: string;
}

// App name which will be appended to resource identifiers
const APP_NAME = "AmazonRDEProd"


// AWS WAF
export class amazonRDEWaf extends DeploymentStack {
    constructor(scope: Construct, id: string, readonly props: WafStackProps) {
        super(scope, id, props);
        // Create Web ACL
        const waf = new CfnWebACL(this, this.props.stage + 'WAFv2', {
            defaultAction: { allow: {} },
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: APP_NAME + '-waf-metrics',
                sampledRequestsEnabled: false,
            },
            scope: 'CLOUDFRONT',
            name: this.props.stage + '-WAF',
            rules: awsManagedRules.map(wafRule => wafRule.rule),
        })

    }
}


interface WafRule {
    name: string;
    rule: CfnWebACL.RuleProperty;
}

const awsManagedRules: WafRule[] = [
    // AWS IP Reputation list includes known malicious actors/bots and is regularly updated
    {
        name: 'AWS-AWSManagedRulesAmazonIpReputationList',
        rule: {
            name: 'AWS-AWSManagedRulesAmazonIpReputationList',
            priority: 10,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: 'AWS',
                    name: 'AWSManagedRulesAmazonIpReputationList',
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: 'AWSManagedRulesAmazonIpReputationList',
            },
        },
    },
    // Common Rule Set aligns with major portions of OWASP Core Rule Set
    {
        name: 'AWS-AWSManagedRulesCommonRuleSet',
        rule:
            {
                name: 'AWS-AWSManagedRulesCommonRuleSet',
                priority: 20,
                statement: {
                    managedRuleGroupStatement: {
                        vendorName: 'AWS',
                        name: 'AWSManagedRulesCommonRuleSet',
                        // Excluding generic RFI body rule for sns notifications
                        // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
                        excludedRules: [
                            { name: 'GenericRFI_BODY' },
                            { name: 'SizeRestrictions_BODY' },
                        ],
                    },
                },
                overrideAction: {
                    none: {},
                },
                visibilityConfig: {
                    sampledRequestsEnabled: true,
                    cloudWatchMetricsEnabled: true,
                    metricName: 'AWS-AWSManagedRulesCommonRuleSet',
                },
            },
    },
    // Blocks common SQL Injection
    {
        name: 'AWSManagedRulesSQLiRuleSet',
        rule: {
            name: 'AWSManagedRulesSQLiRuleSet',
            priority: 30,
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: 'AWSManagedRulesSQLiRuleSet',
            },
            overrideAction: {
                none: {},
            },
            statement: {
                managedRuleGroupStatement: {
                    vendorName: 'AWS',
                    name: 'AWSManagedRulesSQLiRuleSet',
                    excludedRules: [],
                },
            },
        },
    },
    // Blocks common PHP attacks such as using high risk variables and methods in the body or queries
    {
        name: 'AWSManagedRulePHP',
        rule: {
            name: 'AWSManagedRulePHP',
            priority: 40,
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: 'AWSManagedRulePHP',
            },
            overrideAction: {
                none: {},
            },
            statement: {
                managedRuleGroupStatement: {
                    vendorName: 'AWS',
                    name: 'AWSManagedRulesPHPRuleSet',
                    excludedRules: [],
                },
            },
        },
    },
    // Blocks attacks targeting LFI(Local File Injection) for linux systems
    {
        name: 'AWSManagedRuleLinux',
        rule: {
            name: 'AWSManagedRuleLinux',
            priority: 50,
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: 'AWSManagedRuleLinux',
            },
            overrideAction: {
                none: {},
            },
            statement: {
                managedRuleGroupStatement: {
                    vendorName: 'AWS',
                    name: 'AWSManagedRulesLinuxRuleSet',
                    excludedRules: [],
                },
            },
        },
    },
]