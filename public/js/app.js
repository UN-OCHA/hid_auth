



    var jso = new JSO({
        providerID: "hid",
        client_id: "hid-local",
        redirect_uri: "http://auth.contactsid.vm/app.html",
        authorization: "http://auth.contactsid.vm/oauth/authorize",
        scopes: { request: ['profile']}
    });

  jso.callback();


  var opts = {};



//jQuery('#login').mousedown(function (ev) {


  jso.getToken(function(token) {

    console.log("I got the token: ", token);
    window.oauthAccessToken = token.access_token;

    $.ajax({
      success: function (data) {
        alert('account json ' + data);
        window.oauthAccount = data;
      },
      error: function (err) {
        alert('err');
      },
      data: {
        "access_token": token.access_token
      },
      url: "http://auth.contactsid.vm/account.json"
    });


  }, opts);


  
//});

    
    

