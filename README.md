# Tour of Salesforce REST APIs for Multiple DML in Single Request

http://midwestdreamin.com/

In this session, I introduce you to three different Salesforce REST APIs designed specifically
to perform multiple DML to different objects and handle complex data structures in a single request.
See real code and live demos of **Apex REST Services**, **Composite API**, and **SObject Tree API**.
Avoid troublesome rollback scenarios and burning through API requests of traditional development
and learn to design efficient, robust integrations with the Salesforce REST API.


About the Speaker
-----------------

Ironically, Doug Ayers’ first job out of college was to migrate a company from Salesforce to an in-house CRM.
Since then he’s built an accomplished career on leading teams to adopt and run their businesses on the Salesforce platform.
Doug is a Salesforce MVP, Nashville Developer Group Leader, Dreamforce speaker, RAD Women Apex Coach, and impassioned teacher.
Doug holds the prestigious System Architect, Application Architect, and Platform Developer II certifications, for a total of 13 Salesforce certifications.
By day he is a Senior Developer at GearsCRM, architecting robust Apex, Visualforce, and Lightning solutions for customers.
By night he can be found blogging about his Salesforce exploits at https://douglascayers.com.


Getting Started
---------------

1. Install [Heroku Toolbelt](https://devcenter.heroku.com/articles/heroku-cli)
2. Create a [connected app](https://help.salesforce.com/articleView?id=connected_app_create.htm&type=0&language=en_US) in your Salesforce developer org

TODO insert image

3. Clone this project
```
git clone https://github.com/DouglasCAyers/sfdc-rest-apis-for-multiple-dml.git
cd sfdc-rest-apis-for-multiple-dml
```
4. Create or deploy the apex class `/src/classes/MyApexRestService.cls` in your org
5. In the project folder, create file named `.env` that includes the following properties:
```
SFDC_CLIENT_KEY=your connected app key
SFDC_CLIENT_SECRET=your connected app secret
SFDC_PASSWORD=your salesforce password
SFDC_TOKEN=your salesforce token
SFDC_USERNAME=your salesforce username
```
6. Run the app locally via `heroku local`
7. In your browser go to http://localhost:5000/