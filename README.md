# !!! DEPRECATED !!!

This repository contains HID v1 code which is now deprecated.

# Humanitarian ID Oauth2/Open ID Connect Provider

This is a sign on service for Humanitarian ID (H.ID), HumanitarianResponse.info (HR.info), and other OCHA community sites.

H.ID also provides a self-managed approach to contact lists in humanitarian disasters. To find out more about the scope, features and benefits of Humanitarian ID, please visit us at [http://humanitarian.id](http://humanitarian.id).

## Using Humanitarian ID Auth Service

The Humanitarian ID Auth Service is primarily used by Humanitarian ID, and HumanitarianResponse.info.

The approach we use on for the Humanitarian ID app is as follows:

1. Send users to Humanitarian ID auth to authenticate. They are redirected back to the client app with a token.
1. Retrieve basic user account data from H.ID auth using the token (which also validates the token).
1. Fetch and update contacts on behalf of the user by supplying the token as part of the request to H.ID profiles.
1. Retrieve application state data (like active operations, bundles, etc.) with a request to H.ID profiles.

## Integrating with the Auth Service

To integrate with this service, you will need an API key.

### Requesting an API Key

If you are interested in integrating Humanitarian ID authentication on your platform, please contact us (info@humanitarian.id).

To request these keys, you will need to provide the following information:

- The purpose of your application, and how to relates to humanitarian work.
- Acknowledgement that you have read the [Code of Conduct](http://humanitarian.id/code-of-conduct), and that your use of this service will comply to the best of your ability with the guidelines in the code.
- Name of site (displayed to regular user on authorize page, also descriptive for H.ID admins who manage API access)
- Base URL of site (needed for any environment that needs auth integration, so we have records for HR.info prod, dev, and local envs)
- Login URL: The URL on the client site that triggers a login via H.ID auth. This is needed to allow automatic login after registration/password reset. This can be set to any URL if needed. Only needed if you are integrating with the H.ID Drupal Auth module.
- Redirect URL: The URL on the client site where the user is returned after authenticating on H.ID. Only needed if you are integrating with the H.ID Drupal Auth module.

For example, for the HumanitarianResponse.info development server the following was provided:

- Purpose of site: Development server for the HR.info site. The production server helps with the coordination of humanitarian relief efforts worldwide. This website is an OCHA-sponsored property.
- Name: HumanitarianResponse.info (dev1)
- Base URL: http://dev1.humanitarianresponse.info/
- Login URL: http://dev1.humanitarianresponse.info/user
- Redirect URL: http://dev1.humanitarianresponse.info/user

### Information You Will Receive

Based on your application we will generate the following:

- Client key/ID: The "username" of the client site when it uses the authentication service.
- Client secret: The "password" of the client site when it uses the authentication service.

Note: Please don't embed the client secret in the app code. It shouldn't be necessary for a client side app flow. It is included in case you need to make server side calls or for debugging.

If you are using the H.ID Auth Drupal module we will also generate:

- Login URL: The URL on the client site that triggers a login via H.ID auth. This is needed to allow automatic login after registration/password reset. As long as they use the H.ID Auth module as directed, we can anticipate the correct URL.
- Redirect URL: The URL on the client site where the user is returned after authenticating on H.ID. As long as they use the H.ID Auth module as directed, we can anticipate the correct URL.

For example, for the HR.info dev site we provided:

- Client key/ID: `hrinfo-dev1`
- Client secret: `your passphrase`
- Login URL: `http://dev1.humanitarianresponse.info/connect/oauthconnector_hid_oauth`
- Redirect URL: `http://dev1.humanitarianresponse.info/oauth/authorized2/1`

## Example

The dev H.ID auth Oauth2 authorization endpoint is at: `http://auth.dev.humanitarian.id/oauth/authorize`

Here's an example URL for starting the auth process for a sample app with the Client ID `hrinfo-dev1`:

````
http://auth.dev.humanitarian.id/oauth/authorize?response_type=token&client_id=hrinfo-dev1&scope=profile&redirect_uri=hrinfo://authorized&state=12345
````

To start the auth process, send a user to your endpoint with the following URL parameters:

- `redirect_uri` must match redirect URI from above
- `client_id must` match client ID from above
- use `response_type=token`
- use `scope=profile`
- state should be a random value that your application can use to validate the auth response
