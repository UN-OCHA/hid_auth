# Required extra libraries
require 'bootstrap-sass'

# Project Type
project_type = :stand_alone

# Location of the theme's resources.
  css_dir              = "css"
  sass_dir             = "scss"
  javascripts_dir      = "js"
  fonts_dir            = "fonts"
  images_dir           = "images"
  sprite_load_path     = "assets/sprites"
  generated_images_dir = "images/generated"
  relative_assets = true

# Change this to :production when ready to deploy the CSS to the live server.
  environment = :development

# In development, we can turn on the FireSass-compatible debug_info.
  firesass = false

# You can select your preferred output style here (can be overridden via the command line):
# output_style = :expanded or :nested or :compact or :compressed
  output_style = (environment == :development) ? :expanded : :compressed

# To disable debugging comments that display the original location of your selectors. Uncomment:
  line_comments = false

# Pass options to sass. For development, we turn on the FireSass-compatible
# debug_info if the firesass config variable above is true.
  sass_options = (environment == :development && firesass == true) ? {
    :debug_info => true,
    :unix_newlines => true
  } : {
    :quiet => true,
    :unix_newlines => true
  }
