# TemporalGraphs

## Necessary Dependencies
This project requires [NodeJS](https://nodejs.org/en) and the [Angular CLI](https://github.com/angular/angular-cli) installed.

After installing NodeJS you can install the Angular CLI using the following code `npm i -g @angular/cli`.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.2.4.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. 
The application will automatically reload if you change any of the source files.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.
To run the build navigate to the `dist/` directory and run the `index.js` file with node `node index.js`.

## Docker
There is also a Dockerfile and Docker Compose specification in the project. 
This requires Docker to be installed on the host system.

To build and deploy the Docker container run the following command `docker-compose up --build -d`.
The application should be available at `http://localhost:4200/`.
