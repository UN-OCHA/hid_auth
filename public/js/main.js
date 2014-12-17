
(function($){
  var restrictedFieldKeys = [
      'email',
      'email_recovery',
      'pass_new',
      'pass_confirm'
    ],
    originalValues = {};

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
    // Load up modal if there is a hash.
    var hash = window.location.hash;

    if (hash) {
      hash_height = (hash === '#register') ? 520 : 478;
      build_modal(hash, 288, hash_height);
    }

    $('#loginBtn').click(function (e) {
      build_modal('#login', 288, 478);
    });

    $('#registerBtn').click(function (e) {
      build_modal('#register', 288, 520);
    });

    $('#aboutBtn').click(function (e) {
      build_modal('#about', 288, 478);
    });

    $('.forgot-password').click(function (e) {
      $.modal.close();
      build_modal('#forgotPass', 288, 478);
    });

    function build_modal(modal_id, w, h) {
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
