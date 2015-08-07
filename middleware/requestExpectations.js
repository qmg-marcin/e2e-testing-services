'use strict';

var requestReader = require('./requestReader');
var Q = require('q');
var _ = require('underscore');

var expectNextRequestMiddleware = function () {
    var grunt = null;

    var expectedNextRequest = null;
    var expectedPartOfNextUrl = null;

    var prepareForNextRequest = function(request) {
        var deferredPreparation = Q.defer();
        requestReader.readRequestBody(request).then(function(requestBody) {
            if(!requestBody) {
                return deferredPreparation.reject('The request payload cant be empty');
            }
            expectedNextRequest = requestBody;
            deferredPreparation.resolve();
        });
        return deferredPreparation.promise;
    };

    var isNextRequestExpected = function(request) {
        var deferredCheck = Q.defer();

        requestReader.readRequestBody(request).then(function(requestBody) {
            var isBodyExpected = _.isEqual(expectedNextRequest, requestBody);
            if(isBodyExpected) {
                deferredCheck.resolve();
            } else {
                deferredCheck.reject();
            }
        });

        return deferredCheck.promise;
    };

    var prepareForNextRequestUrl = function(request) {
        var deferredPreparation = Q.defer();
        requestReader.readRequestBody(request).then(function(requestBody) {
            if(!requestBody.expectedPartOfNextUrl) {
                return deferredPreparation.reject('The request has to contain "expectedPartOfNextUrl" field.');
            }
            expectedPartOfNextUrl = requestBody.expectedPartOfNextUrl;
            deferredPreparation.resolve();
        });
        return deferredPreparation.promise;
    };

    var isNextUrlExpected = function(url) {
        var wasGivenUrlExpected = url.indexOf(expectedPartOfNextUrl) > -1;
        expectedPartOfNextUrl = null;
        return wasGivenUrlExpected;
    };

    return function(_grunt_) {
        grunt = _grunt_;

        return function(request, response, next) {
            var returnWithError = function() {
                response.writeHead(500);
                response.end();
            };

            var returnWithSuccess = function() {
                response.writeHead(200);
                response.end();
            };

            var filePath = '.' + request.url;

            if (request.url === '/expect-next-request-body') {
                return prepareForNextRequest(request).then(returnWithSuccess, returnWithError);
            }

            if (request.url === '/expect-next-request-url-contains') {
                return prepareForNextRequestUrl(request).then(returnWithSuccess, returnWithError);
            }

            if (expectedPartOfNextUrl && !isNextUrlExpected(request.url)) {
                return returnWithError();
            }

            if (expectedNextRequest) {
                isNextRequestExpected(request)
                    .then(function() {
                        if (grunt.file.exists(filePath)) {
                            return response.end(grunt.file.read(filePath));
                        } else {
                            next();
                        }
                    })
                    .catch(returnWithError)
                    .fin(function() {
                        expectedNextRequest = null;
                    });
            } else {
                next();
            }
        };
    };
};

module.exports = expectNextRequestMiddleware;
