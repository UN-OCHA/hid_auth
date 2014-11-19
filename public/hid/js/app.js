
(function($, angular) {

var contactsId = {
    "title": "Humanitarian ID",
    "sourcePath": "/hid"
  };


//$(document).ready(function () {

var app;

// Initialize ng
app = angular.module('contactsId', ['ngRoute', 'cgBusy', 'angular-spinkit']);

app.value('cgBusyDefaults',{
  message:'Loading...',
  backdrop: true,
  templateUrl: contactsId.sourcePath + '/partials/busy.html',
  delay: 0,
  minDuration: 300
});

app.directive('routeLoadingIndicator', function($rootScope) {
  return {
    restrict: 'E',
    template: "<div ng-show='isRouteLoading' class='loading-indicator'>" +
      "<div class='loading-indicator-body'>" +
        "<h3 class='loading-title'>Loading...</h3>" +
        "<div class='spinner'><rotating-plane-spinner></rotating-plane-spinner></div>" +
      "</div>" +
      "</div>",
    replace: true,
    link: function(scope, elem, attrs) {
      scope.isRouteLoading = false;

      $rootScope.$on('$routeChangeStart', function() {
//        appShow();
        scope.isRouteLoading = true;
      });
      $rootScope.$on('$routeChangeSuccess', function() {
        scope.isRouteLoading = false;
      });
    }
  };
});

app.controller("DefaultCtrl", function($scope) {
//  appHide();
});

app.controller("DashboardCtrl", function($scope, $route, profileService, globalProfileId, userData) {
//  appShow();
  $scope.title = contactsId.title;
  $scope.logoutPath = '/logout';
  $scope.globalProfileId = globalProfileId;
  $scope.userData = userData;

  $scope.checkout = function (cid) {
    var contact = {
      _id: cid,
      _profile: $scope.userData.profile._id,
      userid: $scope.userData.profile.userid,
      status: 0
    };
    profileService.saveContact(contact).then(function(data) {
      if (data && data.status && data.status === 'ok') {
        profileService.clearData();
        $route.reload();
      }
      else {
        alert('error');
      }
    });
  };
});

app.controller("ProfileCtrl", function($scope, $location, $route, $routeParams, profileService, userData, placesOperations) {
  $scope.title = contactsId.title;
  $scope.profileId = $routeParams.profileId || '';
  $scope.profile = {};

//  appShow();

  var pathParams = $location.path().split('/'),
      checkinFlow = pathParams[2] === 'checkin';

  // Setup scope variables from data injected by routeProvider resolve
  $scope.userData = userData;
  $scope.placesOperations = placesOperations;

  if (checkinFlow) {
    $scope.selectedPlace = '';
    $scope.selectedOperation = '';

    for (var idx = 0; idx < $scope.userData.contacts.length; idx++) {
      if ($scope.userData.contacts[idx].type === 'global') {
        $scope.profile = angular.fromJson(angular.toJson($scope.userData.contacts[idx]));
        delete $scope.profile._id;
        delete $scope.profile._contact;
        break;
      }
    }
    $scope.profile.type = 'local';
  }
  else {
    $scope.selectedPlace = 'none';
    $scope.selectedOperation = 'none';
  }

  if ($scope.profileId.length) {
    for (var idx = 0; idx < $scope.userData.contacts.length; idx++) {
      if ($scope.userData.contacts[idx]._id == $scope.profileId) {
        $scope.profile = $scope.userData.contacts[idx];

        if ($scope.profile.locationId) {
          for (var place in $scope.placesOperations) {
            if ($scope.placesOperations.hasOwnProperty(place) && $scope.placesOperations[place].hasOwnProperty($scope.profile.locationId)) {
              $scope.selectedPlace = place;
              $scope.selectedOperation = $scope.profile.locationId;
              break;
            }
          }
        }
        break;
      }
    }
    $scope.profileName = $scope.profile.type === 'global' ? 'Global' : $scope.profile.location;
  }
  else if (!checkinFlow) {
    $scope.profile.type = 'global';
    $scope.profileName = $scope.profile.type === 'global' ? 'Global' : $scope.profile.location;
  }

  $scope.checkMultiFields = function (excludeExtras) {
    var multiFields = {'uri': null, 'voip': 'number', 'email': 'address', 'phone': 'number', 'bundle': null};
    for (var field in multiFields) {
      if (multiFields.hasOwnProperty(field)) {
        if ($scope.profile[field] && $scope.profile[field].filter) {
          $scope.profile[field] = $scope.profile[field].filter(function (el) {
            return ((multiFields[field] === null && el && el.length) || (multiFields[field] && el && el[multiFields[field]] && el[multiFields[field]].length));
          });
        }
        else {
          $scope.profile[field] = [];
        }
        var len = $scope.profile[field].length;
        if (!excludeExtras) {
          if (multiFields[field] === null && (!len || $scope.profile[field][len - 1].length)) {
            $scope.profile[field].push('');
          }
          else if (multiFields[field].length && (!len || $scope.profile[field][len - 1][multiFields[field]].length)) {
            $scope.profile[field].push('');
          }
        }
      }
    }
  };

  $scope.checkMultiFields();
  
  $scope.selectPlace = function () {
    var opkeys = [],
      key;
    for (key in this.operations) {
      if (this.operations.hasOwnProperty(key)) {
        opkeys.push(key);
      }
    }
    $scope.selectedPlace = this.place;
    if (opkeys.length == 1) {
      $scope.selectedOperation = opkeys[0];
    }
  };

  $scope.submitProfile = function () {
    $scope.checkMultiFields(true);
    var profile = $scope.profile;
    profile.userid = $scope.userData.profile.userid;
    profile._profile = $scope.userData.profile._id;
    profile.status = 1;

    if (checkinFlow) {
      profile.locationId = $scope.selectedOperation;
      profile.location = $scope.placesOperations[$scope.selectedPlace][$scope.selectedOperation].name;
    }

    if ($scope.profileId.length) {
      profile._contact = $scope.profileId;
    }
    profileService.saveContact(profile).then(function(data) {
      if (data && data.status && data.status === 'ok') {
        $location.path('/contactsId');
        profileService.clearData();
      }
      else {
        alert('error');
      }
    });
  };
});

app.controller("ContactCtrl", function($scope, $route, $routeParams, profileService, contact) {
//  appShow();
  $scope.title = contactsId.title;
  $scope.contact = contact;

  $scope.back = function () {
    if (history.length) {
      history.back();
    }
    else {
      $location.path('/contactsId');
    }
  };
});

app.controller("ListCtrl", function($scope, $route, $routeParams, profileService, userData, placesOperations) {
//  appShow();
  $scope.title = contactsId.title;
  $scope.location = '';
  $scope.locationId = $routeParams.locationId || '';
  $scope.contacts = [];
  $scope.placesOperations = placesOperations;
  $scope.bundles = {};
  $scope.mode = 'search';
  $scope.contactsPromise;

  for (var place in $scope.placesOperations) {
    if ($scope.placesOperations.hasOwnProperty(place) && $scope.placesOperations[place].hasOwnProperty($scope.locationId)) {
      $scope.location = place;
      $scope.bundles = $scope.placesOperations[place][$scope.locationId].bundles;
      break;
    }
  }

  $scope.showList = function () {
    if ($scope.contacts.length) {
      $scope.mode = 'list';
    }
    else {
      $scope.submitSearch();
    }
  };

  $scope.submitSearch = function () {
    var query = $scope.query;
    query.locationId = $scope.locationId;
    query.status = 1;
    $scope.contactsPromise = profileService.getContacts(query).then(function(data) {
      if (data && data.status && data.status === 'ok') {
        $scope.contacts = data.contacts || [];
      }
    });
    $scope.mode = 'list';
  };

  $scope.resetSearch = function () {
    $scope.query = {
      text: '',
      bundle: '',
      role: ''
    };
  };

  $scope.resetSearch();
});

app.config(function($routeProvider, $locationProvider) {
  $routeProvider.
    when('/', {
      template: '',
      controller: 'DefaultCtrl'
    }).
    when('/contactsId', {
      templateUrl: contactsId.sourcePath + '/partials/dashboard.html',
      controller: 'DashboardCtrl',
      resolve: {
        userData : function(profileService) {
          return profileService.getData().then(function(data) {
            alert('prof', data);
            return data.userData;
          });
        },
        globalProfileId : function(profileService) {
          return profileService.getData().then(function(data) {
            var userData = data.userData;
            for (var idx = 0; idx < userData.contacts.length; idx++) {
              if (userData.contacts[idx].type === 'global') {
                return userData.contacts[idx]._id;
              }
            }
          });
        }
      }
    }).
    when('/contactsId/checkin', {
      templateUrl: contactsId.sourcePath + '/partials/profile.html',
      controller: 'ProfileCtrl',
      resolve: {
        userData : function(profileService) {
          return profileService.getData().then(function(data) {
            return data.userData;
          });
        },
        placesOperations : function(profileService) {
          return profileService.getData().then(function(data) {
            return data.placesOperations;
          });
        }
      }
    }).
    when('/contactsId/profile/:profileId?', {
      templateUrl: contactsId.sourcePath + '/partials/profile.html',
      controller: 'ProfileCtrl',
      resolve: {
        userData : function(profileService) {
          return profileService.getData().then(function(data) {
            return data.userData;
          });
        },
        placesOperations : function(profileService) {
          return profileService.getData().then(function(data) {
            return data.placesOperations;
          });
        }
      }
    }).
    when('/contactsId/contact/:contactId', {
      templateUrl: contactsId.sourcePath + '/partials/contact.html',
      controller: 'ContactCtrl',
      resolve: {
        contact : function(profileService, $route) {
          var query = {
            '_id': $route.current.params.contactId || ''
          };
          return profileService.getContacts(query).then(function(data) {
            return data.contacts[0] || {};
          });
        }
      }
    }).
    when('/contactsId/list/:locationId', {
      templateUrl: contactsId.sourcePath + '/partials/list.html',
      controller: 'ListCtrl',
      resolve: {
        userData : function(profileService) {
          return profileService.getData().then(function(data) {
            return data.userData;
          });
        },
        placesOperations : function(profileService) {
          return profileService.getData().then(function(data) {
            return data.placesOperations;
          });
        }
      }
    });
});

app.service("profileService", function($http, $q) {
  // Return public API.
  return({
    getData: getData,
    clearData: clearData,
    getProfile: getProfile,
    getProfiles: getProfiles,
    getContacts: getContacts,
    saveProfile: saveProfile,
    saveContact: saveContact
  });

  var cacheData = false;

  // Get app data.
  function getData() {
    var promise;

    if (cacheData && cacheData.userData && cacheData.placesOperations) {
      promise = $q.defer();
      promise.resolve(cacheData);
      return promise.promise;
    }
    else {
      promise = $http({
        method: "get",
        url: "http://profiles.contactsid.vm/v0/profile/view",
        params: {userid: window.oauthAccount.user_id, access_token: window.oauthAccessToken}
      })
      .then(handleSuccess, handleError).then(function(data) {
        if (data && data.userData && data.placesOperations) {
          cacheData = data;
        }

        return cacheData;
      });

      return promise;
    }
  }

  // Clear stored app data.
  function clearData() {
    cacheData = {};
  }

  // Get a profile by ID.
  function getProfile(profileId) {
    var request = $http({
      method: "get",
      url: "/contactsid/profile/" + profileId
    });
    return(request.then(handleSuccess, handleError));
  }

  // Get profiles that match specified parameters.
  function getProfiles(terms) {
    return;
  }

  // Get contacts that match specified parameters.
  function getContacts(terms) {
    var request = $http({
      method: "get",
      url: "/contactsid/contact",
      params: terms
    });
    return(request.then(handleSuccess, handleError));
  }

  // Save a profile (create or update existing).
  function saveProfile(profile) {
    var profileId = profile.profileId || "",
    request = $http({
      method: "post",
      url: "/contactsid/profile/" + profileId,
      data: profile
    });
    return(request.then(handleSuccess, handleError));
  }

  // Save a contact (create or update existing).
  function saveContact(contact) {
    var contactId = contact.contactId || "",
    request = $http({
      method: "post",
      url: "/contactsid/contact/" + contactId,
      data: contact
    });
    return(request.then(handleSuccess, handleError));
  }

  function handleError( response ) {
    // The API response from the server should be returned in a
    // nomralized format. However, if the request was not handled by the
    // server (or what not handles properly - ex. server error), then we
    // may have to normalize it on our end, as best we can.
    if ( !angular.isObject(response.data) || !response.data.message ) {
      return ( $q.reject( "An unknown error occurred." ) );
    }

    // Otherwise, use expected error message.
    return ( $q.reject( response.data.message ) );
  }


  function handleSuccess( response ) {
    return ( response.data );
  }

});
//// END ANGULAR

//});

}(jQuery, angular));
