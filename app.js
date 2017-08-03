// ==============================================
// Load libraries
// ==============================================

var dotenv  = require('dotenv').config();       // necessary if running via 'node app.js' instead of 'heroku local'
var jsforce = require('jsforce');               // fabulous library for accessing salesforce! https://jsforce.github.io
var express = require('express');               // turn our nodejs app into a web server
var exphbs  = require('express-handlebars');    // for html templating responses

// ==============================================
// Configure variables
// ==============================================

var conn = new jsforce.Connection({
    oauth2 : {
        clientId : process.env.SFDC_CLIENT_KEY,
        clientSecret : process.env.SFDC_CLIENT_SECRET
    },
    version: process.env.SFDC_API_VERSION
});

conn.login( process.env.SFDC_USERNAME, process.env.SFDC_PASSWORD + process.env.SFDC_TOKEN, function( err, res ) {
    if ( err ) { throw err; }
    console.log( res );
});

// ==============================================
// Configure web app to respond to requests
// ==============================================

var app = express();

app.set( 'json spaces', 4 ); // pretty print json

app.listen( process.env.PORT || 8080 );

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
        'tabHomeSelected' : true
    });
});

app.get( '/pepUpTech', function( req, res ) {
    res.render( 'pepuptech', {
        'tabPepUpTechSelected' : true
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

    // try to create account
    conn.sobject( 'Account' ).create({          // <instance>/services/data/v40.0/sobjects/Account
        'Name' : 'Midwest Dreamin',
        'BillingStreet' : '17 E Monroe St',
        'BillingCity' : 'Chicago',
        'BillingState' : 'Illinois',
        'BillingPostalCode' : '60603'
    }, function( error, accountResponse ) {

        if ( error ) {

            // failed to create account,
            // not continuing to try and create contact
            res.render( 'traditional', {
                'tabTraditionalSelected' : true,
                'accountJsonResponse' : JSON.stringify( error || accountResponse, null, 2 ),
                'contactJsonResponse' : null
            });

        } else {

            // created account, now try to create contact
            conn.sobject( 'Contact' ).create({  // <instance>/services/data/v40.0/sobjects/Contact
                'AccountId' : accountResponse.id,
                'FirstName' : 'Eric',
                'LastName' : 'Dreshfield'
            }, function( error, contactResponse ) {

                // if we failed to create contact then what?
                // no way to rollback... delete account? what if that api call fails?
                // maybe chaining DML operations across multiple transactions and API requests isn't good...
                res.render( 'traditional', {
                    'tabTraditionalSelected' : true,
                    'accountJsonResponse' : JSON.stringify( accountResponse, null, 2 ),
                    'contactJsonResponse' : JSON.stringify( error || contactResponse, null, 2 )
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

        res.render( 'apex', {
            'tabApexSelected' : true,
            'jsonResponse' : JSON.stringify( ( error || response ), null, 2 )
        });

    });

});

/*
    Composite REST API (overview)

    https://developer.salesforce.com/blogs/tech-pubs/2017/01/simplify-your-api-code-with-new-composite-resources.html
    https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_composite.htm

    Executes a series of REST API requests in a single call.
    You can use the output of one request as the input to a subsequent request.
    The response bodies and HTTP statuses of the requests are returned in a single response body.
    The entire request counts as a single call toward your API limits.
    No side effects from email alerts or triggers will have fired if any error.

    Can have up to 25 sub requests; 5 of which can be queries.
    Each sub request runs in its own trigger context as the current user,
    which means if have 3 account sub requests then trigger fires 3 times, once per sub request.
    However, all sub requests together count towards governor limits for a single transaction.

    This example creates an account, contact, opportunity, and assigns primary contact role to the opportunity.
    It queries for the price book and price book entry ids and adds products to the opportunity.
    Again, the entire composite request counts as a single call toward your API limits.
    However, all sub requests together count towards governor limits for a single transaction.
    No side effects from email alerts or triggers will have fired if any error.
 */
app.get( '/api/composite', function ( req, res ) {

    var path = '/services/data/v' + process.env.SFDC_API_VERSION;

    conn.requestPost( path + '/composite', {                        // <instance>/services/data/v40.0/composite
        'allOrNone' : true,
        'compositeRequest' : [
            {
                'method' : 'POST',
                'url' : path + '/sobjects/Account',                 // <instance>/services/data/v40.0/sobjects/Account
                'referenceId' : 'BagginsAccount',
                'body' : {
                    'Name' : 'Baggins',
                    'BillingStreet' : 'Bag End on Bagshot Row',
                    'BillingCity' : 'Hobbiton',
                    'BillingState' : 'Shire'
                }
            },
            {
                'method' : 'POST',
                'url' : path + '/sobjects/Contact',                 // <instance>/services/data/v40.0/sobjects/Contact
                'referenceId' : 'BilboContact',
                'body' : {
                    'AccountId' : '@{BagginsAccount.id}',
                    'FirstName' : 'Bilbo',
                    'LastName' : 'Baggins'
                }
            },
            {
                'method' : 'GET',                                   // <instance>/services/data/v40.0/query
                'url' : path + '/query/?q=' + 'SELECT id FROM PriceBook2 WHERE isStandard = true LIMIT 1',
                'referenceId' : 'PriceBookResults'
            },
            {
                'method' : 'POST',
                'url' : path + '/sobjects/Opportunity',             // <instance>/services/data/v40.0/sobjects/Opportunity
                'referenceId' : 'BilboBirthdayOppty',
                'body' : {
                    'AccountId' : '@{BagginsAccount.id}',
                    'Name' : 'Bilbo Baggins 111th Birthday',
                    'StageName' : 'Prospecting',
                    'CloseDate' : new Date( 2017, 8, 22 ),
                    'PriceBook2Id' : '@{PriceBookResults.records[0].Id}'
                }
            },
            {
                'method' : 'POST',
                'url' : path + '/sobjects/OpportunityContactRole',  // <instance>/services/data/v40.0/sobjects/OpportunityContactRole
                'referenceId' : 'BilboOpptyContactRole',
                'body' : {
                    'OpportunityId' : '@{BilboBirthdayOppty.id}',
                    'ContactId' : '@{BilboContact.id}',
                    'Role' : 'Evaluator',
                    'IsPrimary' : true
                }
            },
            // Just to show what's possible and to be generally agnostic to which dev org this runs in,
            // we query for price book entry ids rather than hard code them. In practice, get them however fits your app's needs.
            {
                'method' : 'GET',                                   // <instance>/services/data/v40.0/query
                'url' : path + '/query/?q=' + 'SELECT id FROM PriceBookEntry WHERE priceBook2Id = \'@{PriceBookResults.records[0].Id}\' AND isActive = true LIMIT 2',
                'referenceId' : 'PriceBookEntryResults'
            },
            {
                'method' : 'POST',
                'url' : path + '/sobjects/OpportunityLineItem',     // <instance>/services/data/v40.0/sobjects/OpportunityLineItem
                'referenceId' : 'OpptyLineItem1',
                'body' : {
                    'OpportunityId' : '@{BilboBirthdayOppty.id}',
                    'PriceBookEntryId' : '@{PriceBookEntryResults.records[0].Id}',
                    'Quantity' : 5,
                    'UnitPrice' : 1000.00
                }
            },
            {
                'method' : 'POST',
                'url' : path + '/sobjects/OpportunityLineItem',     // <instance>/services/data/v40.0/sobjects/OpportunityLineItem
                'referenceId' : 'OpptyLineItem2',
                'body' : {
                    'OpportunityId' : '@{BilboBirthdayOppty.id}',
                    'PriceBookEntryId' : '@{PriceBookEntryResults.records[1].Id}',
                    'Quantity' : 2,
                    'UnitPrice' : 2500.00
                }
            }
        ]
    }, function( error, response ) {

        res.render( 'composite', {
            'tabCompositeSelected' : true,
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
        * Up to 5 records of different types
        * SObject trees up to 5 levels deep

    Is bulk friendly in that all records per level of tree are inserted together.
        * All root level records
        * Then all 2nd level records
        * Then all 3rd level records
        * Then all 4th level records
        * Finally all 5th level records

    That means a trigger will be passed one or more records as compared to Composite API that saves each record individually.
 */
app.get( '/api/tree', function ( req, res ) {

    var path = '/services/data/v' + process.env.SFDC_API_VERSION;

    // Unlike the composite api example that could query for price book and price book entry ids,
    // the sobject tree api does not perform queries, only creates records. So to mimic the composite
    // api example then we must first query for the necessary ids or obtain them somehow.

    var priceBook;
    var priceBookEntries;

    conn.query( formURLEncodeQuery( `SELECT id FROM PriceBook2 WHERE isStandard = true LIMIT 1` ) )
    .then( function( result ) {

        priceBook = result.records[0];
        return conn.query( formURLEncodeQuery( `SELECT id FROM PriceBookEntry WHERE priceBook2Id = '${priceBook.Id}' AND isActive = true LIMIT 2` ) );

    }).then( function( result ) {

        priceBookEntries = result.records;

    }).then( function() {

        conn.requestPost( path + '/composite/tree/Account', {   // <instance>/services/data/v40.0/composite/tree/Account
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
                                'PriceBook2Id' : priceBook.Id,
                                // child relationships
                                'OpportunityLineItems' : {
                                    'records' : [
                                        {
                                            'attributes' : {
                                                'type' : 'OpportunityLineItem',
                                                'referenceId' : 'OpptyLineItem1'
                                            },
                                            // opportunity line item fields
                                            'PriceBookEntryId' : priceBookEntries[0].Id,
                                            'Quantity' : 5,
                                            'UnitPrice' : 1250.00
                                        },
                                        {
                                            'attributes' : {
                                                'type' : 'OpportunityLineItem',
                                                'referenceId' : 'OpptyLineItem2'
                                            },
                                            // opportunity line item fields
                                            'PriceBookEntryId' : priceBookEntries[1].Id,
                                            'Quantity' : 2,
                                            'UnitPrice' : 3189.79
                                        }
                                    ]
                                } // end opportunity line items
                            }
                        ]
                    } // end opportunities
                } // end account
            ] // end tree
        }, function( error, response ) {

            if ( error ) {
                // I've noticed that sobject tree api sends back
                // 400 http status codes for api save errors
                // and that jsforce throws a js error obj in these instances
                // so to get back the json response from the api request
                // we parse it out of the error's message
                // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/errorcodes.htm
                // https://github.com/jsforce/jsforce/blob/1.8.0/lib/http-api.js#L241
                response = JSON.parse( error.message );
            }

            res.render( 'tree', {
                'tabTreeSelected' : true,
                'jsonResponse' : JSON.stringify( response, null, 2 )
            });

        });

    }).catch( function( err ) {

        console.error( err );

        res.render( 'tree', {
            'tabTreeSelected' : true,
            'jsonResponse' : JSON.stringify( err, null, 2 )
        });

    });

});

app.get( '/api/comparison', function ( req, res ) {

    res.render( 'comparison', {
        'tabComparisonSelected' : true
    });

});

function formURLEncodeQuery( query ) {
    // encode url for "application/x-www-form-urlencoded" parameters by further replacing '%20' (space) with '+'
    return query.replace( /%20/g, '+' );
}