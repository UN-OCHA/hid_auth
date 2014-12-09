
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
    $('.nav-tabs').stickyTabs();

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
