// ==============================================
// Load libraries
// ==============================================

var nforce = require('nforce');
var request = require('request');
var express = require('express');


// ==============================================
// Create nforce client to connect to Salesforce
// ==============================================

var client = nforce.createConnection({
    clientId: process.env.SFDC_CLIENT_KEY,
    clientSecret: process.env.SFDC_CLIENT_SECRET,
    redirectUri: 'http://localhost',
    apiVersion: 'v39.0',  // optional, defaults to current salesforce API version
    environment: 'production',  // optional, salesforce 'sandbox' or 'production', production default
    mode: 'multi' // optional, 'single' or 'multi' user mode, multi default
});

var oauth = 'no_token_yet';
client.authenticate({ username: process.env.SFDC_USERNAME, password: process.env.SFDC_PASSWORD + process.env.SFDC_TOKEN }, function( err, resp ) {
    console.log( err );
    console.log( resp );
    // store the oauth object for this user
    if(!err) oauth = resp;
});


// ==============================================
// Configure web app to respond to requests
// ==============================================

var app = express();

app.get( '/', function ( req, res ) {

    var url = oauth.instance_url + '/services/apexrest/v1/service/';

    var data = {
        'requests' : [
            {
                'firstName' : 'Marc',
                'lastName' : 'Benioff',
                'company' : 'Salesforce'
            },
            {
                'firstName' : 'Parker',
                'lastName' : 'Harris',
                'company' : 'Salesforce'
            }
        ]
    };

    request.post( { url: url, json: true, body: data, headers: { Authorization: 'Bearer ' + oauth.access_token } }, function( err, httpResponse, body ) {

        console.log( body );

        res.send( body );

    });

});

app.listen( process.env.PORT || 80 );