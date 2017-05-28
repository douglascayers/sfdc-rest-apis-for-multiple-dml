// ==============================================
// Load libraries
// ==============================================

var dotenv = require('dotenv');
var nforce = require('nforce');
var request = require('request');
var express = require('express');
var exphbs = require('express-handlebars');

dotenv.config(); // if not running via 'heroku local' this ensures the .env file is loaded

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

app.set( 'json spaces', 4 ); // pretty print json

app.use( express.static( __dirname + '/public' ) );

app.engine( 'handlebars', exphbs( { defaultLayout: 'main' } ) );
app.set( 'view engine', 'handlebars' );

app.get( '/', function( req, res ) {
    res.render( 'home', {
        'title' : 'Tour of Salesforce REST APIs for Multiple DML in Single Request',
        'app.name' : 'Midwest Dreamin 2017',
        'tabHomeSelected' : true
    });
});

/*
    Custom Apex REST API

    https://developer.salesforce.com/page/Creating_REST_APIs_using_Apex_REST
    https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_rest_intro.htm
    https://github.com/DouglasCAyers/sfdc-rest-apis-for-multiple-dml/blob/master/src/classes/MyApexRestService.cls
 */
app.get( '/api/custom', function ( req, res ) {

    var url = oauth.instance_url + '/services/apexrest/v1/service/';

    var data = {
        'requests' : [
            {
                'firstName' : 'Marc',
                'lastName' : 'Benioff',
                'company' : 'Salesforce',
                'street' : '1 Market Street',
                'city' : 'San Francisco',
                'state' : 'California'
            },
            {
                'firstName' : 'Parker',
                'lastName' : 'Harris',
                'company' : 'Salesforce',
                'street' : '1 Market Street',
                'city' : 'San Francisco',
                'state' : 'California'
            }
        ]
    };

    var headerData = {
        'Authorization' : 'Bearer ' + oauth.access_token
    };

    request.post( { url: url, json: true, body: data, headers: headerData }, function( err, httpResponse, body ) {

        console.log( JSON.stringify( body, null, 2 ) );

        //res.send( body );

        res.render( 'api_response', {
            'title' : 'Tour of Salesforce REST APIs for Multiple DML in Single Request',
            'app.name' : 'Midwest Dreamin 2017',
            'tabCustomSelected' : true,
            'jsonResponse' : JSON.stringify( body, null, 2 )
        });

    });

});

/*
    Composite REST API

    https://developer.salesforce.com/blogs/tech-pubs/2017/01/simplify-your-api-code-with-new-composite-resources.html
    https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_composite.htm

    Executes a series of REST API requests in a single call.
    You can use the output of one request as the input to a subsequent request.
    The response bodies and HTTP statuses of the requests are returned in a single response body.
    The entire request counts as a single call toward your API limits.
 */
app.get( '/api/composite', function ( req, res ) {

    var url = oauth.instance_url + '/services/data/v39.0/composite/';

    var data = {
        'allOrNone' : true,
        'compositeRequest' : [
            {
                'method' : 'POST',
                'url' : '/services/data/v39.0/sobjects/Account',
                'referenceId' : 'RamseyAccount',
                'body' : {
                    'Name' : 'Ramsey Conference Center',
                    'BillingStreet' : '7104 Crossroads Blvd, Suite 105',
                    'BillingCity' : 'Franklin',
                    'BillingState' : 'Tennessee'
                }
            },
            {
                'method' : 'POST',
                'url' : '/services/data/v39.0/sobjects/Contact',
                'referenceId' : 'RamseyContact',
                'body' : {
                    'AccountId' : '@{RamseyAccount.id}',
                    'FirstName' : 'Dave',
                    'LastName' : 'Ramsey'
                }
            }
        ]
    };

    var headerData = {
        'Authorization' : 'Bearer ' + oauth.access_token
    };

    request.post( { url: url, json: true, body: data, headers: headerData }, function( err, httpResponse, body ) {

        console.log( JSON.stringify( body, null, 2 ) );

        //res.send( body );

        res.render( 'api_response', {
            'title' : 'Tour of Salesforce REST APIs for Multiple DML in Single Request',
            'app.name' : 'Midwest Dreamin 2017',
            'tabCompositeSelected' : true,
            'jsonResponse' : JSON.stringify( body, null, 2 )
        });

    });

});

// example of querying for data and piping that into subsequent requests
app.get( '/api/composite2', function ( req, res ) {

    var url = oauth.instance_url + '/services/data/v39.0/composite/';

    var data = {
        'allOrNone' : true,
        'compositeRequest' : [
            {
                'method' : 'GET',
                'url' : '/services/data/v39.0/query/?q=' + "SELECT id FROM Account WHERE name = 'Ramsey Conference Center' ORDER BY CreatedDate DESC LIMIT 1".replace(/( )+/g, '+' ),
                'referenceId' : 'AccountResults'
            },
            {
                'method' : 'POST',
                'url' : '/services/data/v39.0/sobjects/Contact',
                'referenceId' : 'NewMarkContact',
                'body' : {
                    'AccountId' : '@{AccountResults.records[0].Id}',
                    'FirstName' : 'Mark',
                    'LastName' : 'Morrison'
                }
            },
            {
                'method' : 'POST',
                'url' : '/services/data/v39.0/sobjects/Contact',
                'referenceId' : 'NewChrisContact',
                'body' : {
                    'AccountId' : '@{AccountResults.records[0].Id}',
                    'FirstName' : 'Chris',
                    'LastName' : 'Kelley'
                }
            }
        ]
    };

    var headerData = {
        'Authorization' : 'Bearer ' + oauth.access_token
    };

    request.post( { url: url, json: true, body: data, headers: headerData }, function( err, httpResponse, body ) {

        console.log( JSON.stringify( body, null, 2 ) );

        //res.send( body );

        res.render( 'api_response', {
            'title' : 'Tour of Salesforce REST APIs for Multiple DML in Single Request',
            'app.name' : 'Midwest Dreamin 2017',
            'tabComposite2Selected' : true,
            'jsonResponse' : JSON.stringify( body, null, 2 )
        });

    });

});


/*
    SObject Tree REST API

    https://developer.salesforce.com/blogs/tech-pubs/2017/01/simplify-your-api-code-with-new-composite-resources.html
    https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm

    Creates one or more sObject trees with root records of the specified type.
    An sObject tree is a collection of nested, parent-child records with a single root record.
    That is, you create the parent record (e.g. Account) and then its related lists (e.g. Contacts, Opportunities, Cases).

    The request can contain the following:
        * Up to a total of 200 records across all trees
        * Up to five records of different types
        * SObject trees up to five levels deep
 */
app.get( '/api/tree', function ( req, res ) {

    var url = oauth.instance_url + '/services/data/v39.0/composite/tree/Account'; // root records are accounts

    var data = {
        'records' : [
            {
                'attributes' : {
                    'type' : 'Account',
                    'referenceId' : 'DisneyAccount' // how to cross-ref generated id in response
                },
                // account fields
                'Name' : 'Walt Disney World Resort',
                'BillingStreet' : 'Walt Disney World Resort',
                'BillingCity' : 'Orlando',
                'BillingState' : 'Florida',
                // child relationships
                'Contacts' : {
                    'records' : [
                        {
                            'attributes' : {
                                'type' : 'Contact',
                                'referenceId' : 'WaltDisneyContact'
                            },
                            // contact fields
                            'FirstName' : 'Walt',
                            'LastName' : 'Disney'
                        },
                        {
                            'attributes' : {
                                'type' : 'Contact',
                                'referenceId' : 'RoyDisneyContact'
                            },
                            // contact fields
                            'FirstName' : 'Roy',
                            'LastName' : 'Disney'
                        },
                    ]
                }, // end contacts
                'Opportunities' : {
                    'records' : [
                        {
                            'attributes' : {
                                'type' : 'Opportunity',
                                'referenceId' : 'AmusementParksOppty'
                            },
                            // opportunity fields
                            'Name' : 'Amusement Parks',
                            'StageName' : 'Prospecting',
                            'CloseDate' : '1971-10-01',
                            'Amount' : 149.99
                        }
                    ]
                } // end opportunities
            } // end account
        ] // end tree
    };

    var headerData = {
        'Authorization' : 'Bearer ' + oauth.access_token
    };

    request.post( { url: url, json: true, body: data, headers: headerData }, function( err, httpResponse, body ) {

        console.log( JSON.stringify( body, null, 2 ) );

        //res.send( body );

        res.render( 'api_response', {
            'title' : 'Tour of Salesforce REST APIs for Multiple DML in Single Request',
            'app.name' : 'Midwest Dreamin 2017',
            'tabTreeSelected' : true,
            'jsonResponse' : JSON.stringify( body, null, 2 )
        });

    });

});

app.listen( process.env.PORT || 80 );