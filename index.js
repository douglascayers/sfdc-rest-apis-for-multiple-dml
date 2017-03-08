var nforce = require('nforce');
var request = require('request');
var express = require('express');

var client = nforce.createConnection({
  clientId: process.env.SFDC_CLIENT_KEY,
  clientSecret: process.env.SFDC_CLIENT_SECRET,
  redirectUri: 'http://localhost',
  apiVersion: 'v39.0',  // optional, defaults to current salesforce API version
  environment: 'production',  // optional, salesforce 'sandbox' or 'production', production default
  mode: 'multi' // optional, 'single' or 'multi' user mode, multi default
});

var oauth;
client.authenticate({ username: process.env.SFDC_USERNAME, password: process.env.SFDC_PASSWORD }, function( err, resp ) {
  // store the oauth object for this user
  if(!err) oauth = resp;
});

var app = express();

app.get('/', function ( req, res ) {



    res.send('Hello World');

});

app.listen( process.env.PORT || 80 );