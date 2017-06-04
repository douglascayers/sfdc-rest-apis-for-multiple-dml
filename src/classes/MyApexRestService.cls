/**
 * Example Apex REST web service for creating multiple objects via API.
 *
 * Developed by Doug Ayers (douglascayers.com)
 * https://github.com/DouglasCAyers/sfdc-rest-apis-for-multiple-dml
 */
@RestResource( urlMapping = '/v1/service/*')
global class MyApexRestService {

    /**
     * Creates an account and contact in a single transaction with one API request.
     * If all successful then a response per account/contact created is returned.
     * If any error then one response returned with error message.
     */
    @HttpPost
    global static Response saveData( Request request ) {

        Response response = new Response();

        SavePoint sp = Database.setSavePoint();

        try {

            Account acct = new Account(
                name = request.company,
                billingStreet = request.street,
                billingCity = request.city,
                billingState = request.state
            );

            insert acct;

            Contact cont = new Contact(
                accountId = acct.id,
                firstName = request.firstName,
                lastName = request.lastName
            );

            insert cont;

            response.success = true;
            response.accountId = acct.id;
            response.contactId = cont.id;

        } catch ( Exception e ) {

            Database.rollback( sp );

            response.success = false;
            response.message = e.getMessage();
            response.detailMessage = e.getStackTraceString();

        }

        return response;
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