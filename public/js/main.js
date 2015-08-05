
(function($){
  var restrictedFieldKeys = [
      'email',
      'email_recovery',
      'pass_new',
      'pass_confirm'
    ],
    originalValues = {};

    //Password Strength
    "use strict";
    var options = {};
    options.ui = {
        //container: "#pwd-container",
        showStatus: true,
        showProgressBar: true,
        showVerdictsInsideProgressBar: true,
        
    };
    $('#pass_new').pwstrength(options);

    //Show Password
  $(document).ready(function() {
  $('#showPassword').click(function() {
    if ($('#pass_login').attr("type") == "password") {
      $('#pass_login').attr("type", "text");

    } else {
      $('#pass_login').attr("type", "password");
    }
  });
  });

  function checkFields() {
    var changed = false;
    restrictedFieldKeys.forEach(function (val, idx, arr) {
      var el = $('input[name="' + val + '"]');
      if (el.length && el.val() != originalValues[idx]) {
        changed = true;
      }
    });
    if (changed) {
      $('input[name="pass_current"]').parent().removeClass('hidden').attr('required', 'required');
    }
    else {
      $('input[name="pass_current"]').parent().addClass('hidden').removeAttr('required');
    }
  }

  $(document).ready(function () {
    function loadModal() {
      // Load up modal if there is a hash.
      var hash = window.location.hash;

      if (hash && $(hash).length) {
        hash_height = (hash === '#register' || hash == '#create' || hash == '#edit') ? 520 : 478;
        build_modal(hash, 288, hash_height);
      }
    }

    $(window).on('hashchange', function(e) {
      loadModal();
    });
    loadModal();

    function build_modal(modal_id, w, h) {
      $.modal.close();
      $(modal_id).modal({
        opacity:87,
        containerCss:{
          width: w,
          height: h
        },
        overlayCss: {backgroundColor:"#438ea0"}
      });
      return false;
    }

    $('.close-modal').click(function (e) {
      $.modal.close();
    });

    restrictedFieldKeys.forEach(function (val, idx, arr) {
      var el = $('input[name="' + val + '"]');
      if (el.length) {
        // Save original form field values.
        originalValues[idx] = el.val();

        // Set up change event handlers for specific fields.
        el.change(function () {
          checkFields();
        });
      }
    });
  });

}(jQuery));
