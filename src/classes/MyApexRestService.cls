/**
 * Example Apex REST web service for creating multiple objects via API.
 *
 * Developed by Doug Ayers (douglascayers.com)
 * https://github.com/DouglasCAyers/nashville-sfdc-apex-rest
 */
@RestResource( urlMapping = '/v1/service/*')
global class MyApexRestService {

    /**
     * Creates one or more accounts and contacts in a single transaction.
     * If all successful then a response per account/contact created is returned.
     * If any error then one response returned with error message.
     */
    @HttpPost
    global static List<Response> saveData( List<Request> requests ) {

        System.debug( 'saving data' );
        System.debug( requests );

        SavePoint sp = Database.setSavepoint();

        List<Response> responses = new List<Response>();

        try {

            List<Account> newAccounts = new List<Account>();
            List<Contact> newContacts = new List<Contact>();

            for ( Integer i = 0; i < requests.size(); i++ ) {

                newAccounts.add( new Account(
                    name = requests[i].company,
                    billingStreet = requests[i].street,
                    billingCity = requests[i].city,
                    billingState = requests[i].state
                ));

            }

            insert newAccounts;

            for ( Integer i = 0; i < requests.size(); i++ ) {

                newContacts.add( new Contact(
                    accountId = newAccounts[i].id,
                    firstName = requests[i].firstName,
                    lastName = requests[i].lastName,
                    mailingStreet = requests[i].street,
                    mailingCity = requests[i].city,
                    mailingState = requests[i].state
                ));

            }

            insert newContacts;

            for ( Integer i = 0; i < requests.size(); i++ ) {

                Response res = new Response();

                res.success = true;
                res.accountId = newAccounts[i].id;
                res.contactId = newContacts[i].id;

                responses.add( res );

            }

        } catch ( Exception e ) {

            Database.rollback( sp );

            System.debug( LoggingLevel.ERROR, e.getMessage() + ' : ' + e.getStackTraceString() );

            Response res = new Response();

            res.success = false;
            res.message = e.getMessage();
            res.detailMessage = e.getStackTraceString();

            responses = new List<Response>{ res };

        }

        return responses;
    }

    global class Request {

        global String firstName;
        global String lastName;
        global String company;
        global String street;
        global String city;
        global String state;

    }

    global class Response {

        global Boolean success;
        global String message;
        global String detailMessage;

        global ID accountId;
        global ID contactId;

    }

}