// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

require('dotenv').config()
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();
const secretsManager = new AWS.SecretsManager();

const ImageRequest = require('./image-request.js');
const ImageHandler = require('./image-handler.js');

const imageHandler = async (event) => {
    console.log(event);
    const imageRequest = new ImageRequest(s3, secretsManager);
    const imageHandler = new ImageHandler(s3, rekognition);
    const isAlb = event.requestContext && event.requestContext.hasOwnProperty('elb');

    try {
        const request = await imageRequest.setup(event);
        console.log(request);

        const processedRequest = await imageHandler.process(request);
        const headers = getResponseHeaders(false, isAlb);
        headers["Content-Type"] = request.ContentType;
        headers["Expires"] = request.Expires;
        headers["Last-Modified"] = request.LastModified;
        headers["Cache-Control"] = request.CacheControl;

        if (request.headers) {
            // Apply the custom headers overwritting any that may need overwriting
            for (let key in request.headers) {
                headers[key] = request.headers[key];
            }
        }

        console.log({
            statusCode: 200,
            isBase64Encoded: true,
            headers : headers,
            body: processedRequest
        })

        return {
            statusCode: 200,
            isBase64Encoded: true,
            headers : headers,
            body: processedRequest
        };
    } catch (err) {
        console.error(err);

        // Default fallback image
        if (process.env.ENABLE_DEFAULT_FALLBACK_IMAGE === 'Yes'
            && process.env.DEFAULT_FALLBACK_IMAGE_BUCKET
            && process.env.DEFAULT_FALLBACK_IMAGE_BUCKET.replace(/\s/, '') !== ''
            && process.env.DEFAULT_FALLBACK_IMAGE_KEY
            && process.env.DEFAULT_FALLBACK_IMAGE_KEY.replace(/\s/, '') !== '') {
            try {
                const bucket = process.env.DEFAULT_FALLBACK_IMAGE_BUCKET;
                const objectKey = process.env.DEFAULT_FALLBACK_IMAGE_KEY;
                const defaultFallbackImage = await s3.getObject({ Bucket: bucket, Key: objectKey }).promise();
                const headers = getResponseHeaders(false, isAlb);
                headers['Content-Type'] = defaultFallbackImage.ContentType;
                headers['Last-Modified'] = defaultFallbackImage.LastModified;
                headers['Cache-Control'] = 'max-age=31536000,public';

                return {
                    statusCode: err.status ? err.status : 500,
                    isBase64Encoded: true,
                    headers: headers,
                    body: defaultFallbackImage.Body.toString('base64')
                };
            } catch (error) {
                console.error('Error occurred while getting the default fallback image.', error);
            }
        }

        if (err.status) {
            return {
                statusCode: err.status,
                isBase64Encoded: false,
                headers : getResponseHeaders(true, isAlb),
                body: JSON.stringify(err)
            };
        } else {
            return {
                statusCode: 500,
                isBase64Encoded: false,
                headers : getResponseHeaders(true, isAlb),
                body: JSON.stringify({ message: 'Internal error. Please contact the system administrator.', code: 'InternalError', status: 500 })
            };
        }
    }
}

/**
 * Generates the appropriate set of response headers based on a success
 * or error condition.
 * @param {boolean} isErr - has an error been thrown?
 * @param {boolean} isAlb - is the request from ALB?
 * @return {object} - Headers object
 */
const getResponseHeaders = (isErr = false, isAlb = false) => {
    const corsEnabled = (process.env.CORS_ENABLED === "Yes");
    const headers = {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
    if (!isAlb) {
        headers["Access-Control-Allow-Credentials"] = true;
    }
    if (corsEnabled) {
        headers["Access-Control-Allow-Origin"] = process.env.CORS_ORIGIN;
    }
    if (isErr) {
        headers["Content-Type"] = "application/json"
    }
    return headers;
}

exports.handler = imageHandler

imageHandler({
    resource: '/{proxy+}',
    path: '/eyJidWNrZXQiOiJtdWRlZSIsImtleSI6InN0b3JhZ2UvcmVhbHRpZXMvMWYyNzIyZDYtYWY4YS00ODgxLWI1ZmEtMzMyZjViZTJlZGI4XzE1NjA4MDc0MjE2NTQvRkwyMTEuanBlZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MTIzLCJoZWlnaHQiOjEyMywiZml0IjoiZmlsbCJ9fX0=',
    httpMethod: 'GET',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip',
      Host: 'udjhwt7wdd.execute-api.us-east-1.amazonaws.com',
      'User-Agent': 'Amazon CloudFront',
      Via: '2.0 33f9cfc7fcfb29cd348695884c758731.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'qr65iVY3Tp0KXU0LdtRllGD7urioRP6S0rbmdjJQ9P91oAwo9h9iFQ==',
      'X-Amzn-Trace-Id': 'Root=1-60a7e834-4f95d48e078d6239767e2ca6',
      'X-Forwarded-For': '177.143.198.248, 64.252.78.3',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https'
    },
    multiValueHeaders: {
      Accept: [
        'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      ],
      'Accept-Encoding': [ 'gzip' ],
      Host: [ 'udjhwt7wdd.execute-api.us-east-1.amazonaws.com' ],
      'User-Agent': [ 'Amazon CloudFront' ],
      Via: [
        '2.0 33f9cfc7fcfb29cd348695884c758731.cloudfront.net (CloudFront)'
      ],
      'X-Amz-Cf-Id': [ 'qr65iVY3Tp0KXU0LdtRllGD7urioRP6S0rbmdjJQ9P91oAwo9h9iFQ==' ],
      'X-Amzn-Trace-Id': [ 'Root=1-60a7e834-4f95d48e078d6239767e2ca6' ],
      'X-Forwarded-For': [ '177.143.198.248, 64.252.78.3' ],
      'X-Forwarded-Port': [ '443' ],
      'X-Forwarded-Proto': [ 'https' ]
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: {
      proxy: 'eyJidWNrZXQiOiJtdWRlZSIsImtleSI6InN0b3JhZ2UvcmVhbHRpZXMvMWYyNzIyZDYtYWY4YS00ODgxLWI1ZmEtMzMyZjViZTJlZGI4XzE1NjA4MDc0MjE2NTQvRkwyMTEuanBlZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MTIzLCJoZWlnaHQiOjEyMywiZml0IjoiZmlsbCJ9fX0='
    },
    stageVariables: null,
    requestContext: {
      resourceId: 'vq67tr',
      resourcePath: '/{proxy+}',
      httpMethod: 'GET',
      extendedRequestId: 'fsE4LG2roAMFp4A=',
      requestTime: '21/May/2021:17:04:52 +0000',
      path: '/image/eyJidWNrZXQiOiJtdWRlZSIsImtleSI6InN0b3JhZ2UvcmVhbHRpZXMvMWYyNzIyZDYtYWY4YS00ODgxLWI1ZmEtMzMyZjViZTJlZGI4XzE1NjA4MDc0MjE2NTQvRkwyMTEuanBlZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MTIzLCJoZWlnaHQiOjEyMywiZml0IjoiZmlsbCJ9fX0=',
      accountId: '186262579074',
      protocol: 'HTTP/1.1',
      stage: 'image',
      domainPrefix: 'udjhwt7wdd',
      requestTimeEpoch: 1621616692285,
      requestId: 'cae94835-b846-4a47-bdb9-a2d9721d700b',
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '177.143.198.248',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'Amazon CloudFront',
        user: null
      },
      domainName: 'udjhwt7wdd.execute-api.us-east-1.amazonaws.com',
      apiId: 'udjhwt7wdd'
    },
    body: null,
    isBase64Encoded: false
  })