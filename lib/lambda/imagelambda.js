exports.handler =  function(event, context, callback) {
    var token = event.authorizationToken;
    switch (token) {
        case 'YW1hem9ucmRlbGFtYmRhYWxsb3drZXk=':
            callback(null, generatePolicy('user', 'Allow', event.methodArn));
            break;
        case 'deny':
            callback(null, generatePolicy('user', 'Deny', event.methodArn));
            break;
        case 'unauthorized':
            callback("Unauthorized");   // Return a 401 Unauthorized response
            break;
        default:
            callback("Error: Invalid token"); // Return a 500 Invalid token response
    }
};

// Help function to generate an IAM policy
var generatePolicy = function(principalId, effect, resource) {
    var authResponse = {};

    authResponse.principalId = principalId;
    if (effect && resource) {
        var policyDocument = {
            Version : '2012-10-17',
            Statement: [],
        };
        var statementOne = {
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: resource,
        };
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }

    // Optional output with custom properties of the String, Number or Boolean type.

    return authResponse;
};