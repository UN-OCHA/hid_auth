## Ubuntu/Linux Mint setup instructions

1. Install fig and pip with `sudo apt-get install python-pip` and `sudo pip install fig`
1. Install Docker with `curl -sSL https://get.docker.com/ | sh`
1. Add your user to the Docker group with `sudo usermod -aG docker $USER`
1. Log out and back in for the group change to take effect
1. Start docker with `sudo start docker`
1. Log into Docker with the credentials furnished to you with `docker login`
1. Run `fig up`. This will pull the containers down and set them up.
1. Once `fig up` has completed, visit http://localhost:8989 in your browser to access the site. The logs will also appear in the foreground. To stop the services, just type Ctrl-c.

