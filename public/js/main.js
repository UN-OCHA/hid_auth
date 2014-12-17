
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

    $('#loginBtn').click(function (e) {
      $("#login").modal({
        opacity:87,
        containerCss:{
          //minHeight: 422,
          width: 288
        },
        overlayCss: {backgroundColor:"#438ea0"}
      });
      return false;
    });

    $('#registerBtn').click(function (e) {
      $("#register").modal({
        opacity:87,
        containerCss:{
          width: 288
        },
        overlayCss: {backgroundColor:"#438ea0"}
      });
      return false;
    });

    $('#aboutBtn').click(function (e) {
      $("#about").modal({
        opacity:87,
        containerCss:{
          width: 288
        },
        overlayCss: {backgroundColor:"#438ea0"}
      });
      return false;
    });

    $('.forgot-password').click(function (e) {
      $.modal.close();

      $("#forgotPass").modal({
        opacity:87,
        containerCss:{
          width: 288
        },
        overlayCss: {backgroundColor:"#438ea0"}
      });
      return false;
    });

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
