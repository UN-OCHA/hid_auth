## Ubuntu/Linux Mint Docker setup instructions

This will set up Docker and the fig tool that spins up the sets of container needed for the project.

1. Install fig and pip with `sudo apt-get install python-pip` and `sudo pip install fig`
1. Install Docker with `curl -sSL https://get.docker.com/ | sh`
1. Add your user to the Docker group with `sudo usermod -aG docker $USER`
1. Log out and back in for the group change to take effect
1. Start docker with `sudo start docker`
1. Log into Docker with the credentials furnished to you with `docker login`. This only needs to be done once.

## Set up DNS hostnames for all containers

This setup will let you use .vm addresses to access every container directly instead of with port forwarding.

This is how the Mac development setup works as well.

1. Install libnss-resolver from https://github.com/azukiapp/libnss-resolver/releases .
1. Set up where .vm hostnames should be resolved with `echo 'nameserver 172.17.42.1:53' | sudo tee /etc/resolver/vm`
1. Run the dnsdock container with `docker run -d --name=dnsdock -e DNSDOCK_NAME=dnsdock -e DNSDOCK_IMAGE=dnsdock -p 172.17.42.1:53:53/udp -v /var/run/docker.sock:/var/run/docker.sock phase2/dnsdock`
1. Now, test that DNS resolution is working first with dig with `dig @172.17.42.1 dnsdock.dnsdock.vm`
1. Finally, try `ping dnsdock.dnsdock.vm` to verify that the normal libnss stack works using libnss-resolver.

## Running the app

1. Run `fig up`. This will pull the containers down and set them up.
1. Once `fig up` has completed, visit http://auth.contactsid.vm in your browser to access the site. The logs will also appear in the foreground. To stop the services, just type Ctrl-c.

The web server will be accessible at auth.contactsid.vm and the mongo server will be available at mongo.contactsid.vm.

You may use the `docker exec` command to get a root shell on either container if you need to log in directly. The main server in the container will run as process ID 1, and when it terminates, so will the container.

The following command will open a root shell on the main auth container, which fig will name `linux_auth_1`. You can always get a list of running containers by running the `docker ps` command.

```
docker exec -it linux_auth_1 bash
```

## Troubleshooting

If http://auth.contactsid.vm does not work, you can also try accessing the app at http://localhost:8989.

