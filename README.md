# TimeLighting

TimeLighting is a visual analytics tool designed to explore and analyze temporal (event-based) networks by projecting their node trajectories and edge surfaces from a 3D space-time cube to a 2D visualization. Built with D3.js, the tool addresses challenges in temporal graph visualization, such as precision loss and poor task performance in traditional slicing or animation-based techniques. TimeLighting provides interactive features to highlight node trajectories, visualize node "aging", and guide users by identifying interesting time intervals and network elements for deeper investigation. Its user-friendly interface enables researchers and analysts to identify temporal patterns and extract insights efficiently.

Pre-print: [Arxiv]()

## Demonstration Video
[![TimeLighting Demonstration](https://img.youtube.com/vi/GqBbqNR07rA/0.jpg)](https://youtu.be/GqBbqNR07rA)

## Necessary Dependencies
This project requires [NodeJS](https://nodejs.org/en) and the [Angular CLI](https://github.com/angular/angular-cli) installed.

Alternatively, the project can be setup and deployed using Docker [Docker](https://www.docker.com/).

After installing NodeJS you can install the Angular CLI using the following code `npm i -g @angular/cli`.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.2.4 and [NodeJS](https://nodejs.org/en) version 20.

## Getting Started
Clone the repository
```console
foo@bar:~$ git clone https://github.com/velitchko/timelighting.git
```

### Running TimeLighting
A step-by-step guide to setup and start running TimeLighting:

Navigate to the backend:
```console
foo@bar:~$ cd temporal-graphs
```
Install the dependencies:
```console
foo@bar:~$ npm install --legacy-peer-deps
```
Start the frontend:
```console
foo@bar:~$ npm run start
```

### Docker
A step-by-sdtep guide to setup the study with Docker: 

Note: Make sure you have [Docker](https://www.docker.com/) installed.

Build the backend and frontend containers:
```console
foo@bar:~$ docker compose build
```
Start the containers:
```console
foo@bar:~$ docker compose up
```

## Authors

<table>
<tr>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href="https://github.com/velitchko">
            <img src=https://github.com/velitchko.png width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt="Velitchko Filipov"/>
            <br />
            <sub style="font-size:14px"><b>@velitchko</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/EngAAlex>
            <img src=https://github.com/EngAAlex.png width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt="Alessio Arleo"/>
            <br />
            <sub style="font-size:14px"><b>@henry-ehlers</b></sub>
        </a>
    </td>
</tr>
</table>

