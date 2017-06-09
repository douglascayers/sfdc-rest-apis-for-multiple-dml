// ==============================================
// Load libraries
// ==============================================

var dotenv  = require('dotenv').config(); // necessary if running via 'node app.js' instead of 'heroku local'
var jsforce = require('jsforce'); // fabulous library for accessing salesforce! https://jsforce.github.io
var express = require('express'); // turn our nodejs app into a web server
var exphbs  = require('express-handlebars'); // for html templating responses

// ==============================================
// Configure variables
// ==============================================

var conn = new jsforce.Connection({
    oauth2 : {
        clientId : process.env.SFDC_CLIENT_KEY,
        clientSecret : process.env.SFDC_CLIENT_SECRET
    }
});

conn.login( process.env.SFDC_USERNAME, process.env.SFDC_PASSWORD + process.env.SFDC_TOKEN, function( err, res ) {
    if ( err ) { throw err; }
    console.log( res );
});

var webPageTitle = 'Tour of Salesforce REST APIs for Multiple DML in Single Request';
var webAppName = 'Midwest Dreamin 2017';


// ==============================================
// Configure web app to respond to requests
// ==============================================

var app = express();

app.set( 'json spaces', 4 ); // pretty print json

app.listen( process.env.PORT || 80 );

app.use( express.static( __dirname + '/public' ) );

app.engine( 'handlebars', exphbs( { defaultLayout: 'main' } ) );
app.set( 'view engine', 'handlebars' );


// ==============================================
// Configure web app endpoints
// ==============================================

/*
    Home Page
 */
app.get( '/', function( req, res ) {
    res.render( 'home', {
        'title' : webPageTitle,
        'app.name' : webAppName,
        'tabHomeSelected' : true
    });
});


/*
    Traditional Approach

    https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_sobject_create.htm

    Executes multiple API calls to create data.
    First creates account then if successful creates more related records.
    Each request counts towards your API call limit, and runs in its own separate transaction.
    An error on the 2nd or 3rd request cannot easily "rollback" or "undo" earlier changes.
    Any side effects like email alerts and triggers will have already fired and happened.
 */
app.get( '/api/traditional', function( req, res ) {

    var sendBrowserResponse = function( jsonObj ) {
        res.render( 'api_response', {
            'title' : webPageTitle,
            'app.name' : webAppName,
            'tabTraditionalSelected' : true,
            'jsonResponse' : JSON.stringify( jsonObj, null, 2 )
        });
    };

    // try to create account
    conn.sobject( 'Account' ).create({          // <instance>/services/data/39.0/sobjects/Account
        'Name' : 'Midwest Dreamin',
        'BillingStreet' : '17 E Monroe St',
        'BillingCity' : 'Chicago',
        'BillingState' : 'Illinois'
    }, function( error, accountResponse ) {

        if ( error ) {

            // failed to create account,
            // not continuing to try and create contact
            sendBrowserResponse({
                'account' : ( error || accountResponse ),
                'contact' : null
            });

        } else {

            // created account, now try to create contact
            conn.sobject( 'Contact' ).create({  // <instance>/services/data/39.0/sobjects/Contact
                'AccountId' : accountResponse.id,
                'FirstName' : 'Eric',
                'LastName' : 'Dreshfield'
            }, function( error, contactResponse ) {

                // if we failed to create contact then what?
                // no way to rollback... delete account? what if that api call fails?
                // maybe chaining DML operations across multiple transactions and API requests isn't good...
                sendBrowserResponse({
                    'account' : accountResponse,
                    'contact' : ( error || contactResponse )
                });

            });

        }

    });

});


/*
    Custom Apex REST API

    https://developer.salesforce.com/page/Creating_REST_APIs_using_Apex_REST
    https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_rest_intro.htm
    https://github.com/DouglasCAyers/sfdc-rest-apis-for-multiple-dml/blob/master/src/classes/MyApexRestService.cls

    Executes a single API request to a custom Apex REST service.
    The apex class creates a new Account and Contact based on the arguments.
    If any error then the method rollsback the entire transaction for an "all or none" result.
    No side effects from email alerts or triggers will have fired if any error.
 */
app.get( '/api/apex', function ( req, res ) {

    conn.apex.post( '/MyApexRestService', { // <instance>/services/apexrest/MyApexRestService
        'request' : {

            'firstName' : 'Marc',           // contact.firstName
            'lastName' : 'Benioff',         // contact.lastName

            'company' : 'Salesforce',       // account.name
            'street' : '1 Market Street',   // account.billingStreet
            'city' : 'San Francisco',       // account.billingCity
            'state' : 'California'          // account.billingState

        }
    }, function( error, response ) {

        res.render( 'api_response', {
            'title' : webPageTitle,
            'app.name' : webAppName,
            'tabApexSelected' : true,
            'jsonResponse' : JSON.stringify( ( error || response ), null, 2 )
        });

    });

});

/*
    Composite REST API (example 1)

    https://developer.salesforce.com/blogs/tech-pubs/2017/01/simplify-your-api-code-with-new-composite-resources.html
    https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_composite.htm

    Executes a series of REST API requests in a single call.
    You can use the output of one request as the input to a subsequent request.
    The response bodies and HTTP statuses of the requests are returned in a single response body.
    The entire request counts as a single call toward your API limits.
    No side effects from email alerts or triggers will have fired if any error.
 */
app.get( '/api/composite', function ( req, res ) {

    var path = '/services/data/v39.0';

    conn.requestPost( path + '/composite', {            // <instance>/services/data/v39.0/composite
        'allOrNone' : true,
        'compositeRequest' : [
            {
                'method' : 'POST',
                'url' : path + '/sobjects/Account',     // <instance>/services/data/v39.0/sobjects/Account
                'referenceId' : 'GearsAccount',
                'body' : {
                    'Name' : 'GearsCRM',
                    'BillingStreet' : '10 Kearney Road, Suite 152',
                    'BillingCity' : 'Needham',
                    'BillingState' : 'Massachusetts'
                }
            },
            {
                'method' : 'POST',
                'url' : path + '/sobjects/Contact',     // <instance>/services/data/v39.0/sobjects/Contact
                'referenceId' : 'GearsContact',
                'body' : {
                    'AccountId' : '@{GearsAccount.id}',
                    'FirstName' : 'Harry',
                    'LastName' : 'Radenberg'
                }
            }
        ]
    }, function( error, response ) {

        res.render( 'api_response', {
            'title' : webPageTitle,
            'app.name' : webAppName,
            'tabCompositeSelected' : true,
            'jsonResponse' : JSON.stringify( ( error || response ), null, 2 )
        });

    });

});


/*
    Composite REST API (example 2)

    https://developer.salesforce.com/blogs/tech-pubs/2017/01/simplify-your-api-code-with-new-composite-resources.html
    https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_composite.htm

    First request queries for existing account then
    subsequent request creates a new contact at that account.
    Again, the entire request counts as a single call toward your API limits.
    No side effects from email alerts or triggers will have fired if any error.
 */
app.get( '/api/composite2', function ( req, res ) {

    var path = '/services/data/v39.0';

    conn.requestPost( path + '/composite', {            // <instance>/services/data/v39.0/composite
        'allOrNone' : true,
        'compositeRequest' : [
            {
                'method' : 'GET',                       // <instance>/services/data/v39.0/query
                'url' : path + '/query/?q=' + "SELECT id FROM Account WHERE name = 'GearsCRM' ORDER BY CreatedDate DESC LIMIT 1".replace(/( )+/g, '+' ),
                'referenceId' : 'AccountResults'
            },
            {
                'method' : 'POST',
                'url' : path + '/sobjects/Contact',     // <instance>/services/data/v39.0/sobjects/Contact
                'referenceId' : 'NewContact',
                'body' : {
                    'AccountId' : '@{AccountResults.records[0].Id}',
                    'FirstName' : 'Doug',
                    'LastName' : 'Ayers'
                }
            }
        ]
    }, function( error, response ) {

        res.render( 'api_response', {
            'title' : webPageTitle,
            'app.name' : webAppName,
            'tabComposite2Selected' : true,
            'jsonResponse' : JSON.stringify( ( error || response ), null, 2 )
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
    It is a specialized variant of the Composite API.

    The request can contain the following:
        * Up to a total of 200 records across all trees
        * Up to five records of different types
        * SObject trees up to five levels deep
 */
app.get( '/api/tree', function ( req, res ) {

    var path = '/services/data/v39.0';

    conn.requestPost( path + '/composite/tree/Account', {   // <instance>/services/data/v39.0/composite/tree/Account
        'records' : [
            {
                'attributes' : {
                    'type' : 'Account',
                    'referenceId' : 'DisneyAccount'
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
    }, function( error, response ) {

        res.render( 'api_response', {
            'title' : webPageTitle,
            'app.name' : webAppName,
            'tabTreeSelected' : true,
            'jsonResponse' : JSON.stringify( ( error || response ), null, 2 )
        });

    });

});
