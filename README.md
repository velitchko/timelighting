# TimeLighting

 [![](https://www.replicabilitystamp.org/logo/Reproducibility-small.png)](http://www.replicabilitystamp.org#https-github-com-velitchko-timelighting)


TimeLighting is a visual analytics tool designed to explore and analyze temporal (event-based) networks by projecting their node trajectories and edge surfaces from a 3D space-time cube to a 2D visualization. Built with D3.js, the tool addresses challenges in temporal graph visualization, such as precision loss and poor task performance in traditional slicing or animation-based techniques. TimeLighting provides interactive features to highlight node trajectories, visualize node "aging", and guide users by identifying interesting time intervals and network elements for deeper investigation. Its user-friendly interface enables researchers and analysts to identify temporal patterns and extract insights efficiently.

Paper (early access): [IEEE Xplore](https://ieeexplore.ieee.org/document/10787140)

Cite as:
```console
@article{timelighting2024,
  author={Filipov, Velitchko and Ceneda, Davide and Archambault, Daniel and Arleo, Alessio},
  journal={IEEE Transactions on Visualization and Computer Graphics}, 
  title={TimeLighting: Guided Exploration of 2D Temporal Network Projections}, 
  year={2024},
  volume={},
  number={},
  pages={1-13},
  keywords={Human-centered computing–Visualization–Graph drawings;Empirical studies in visualization},
  doi={10.1109/TVCG.2024.3514858}
}
```

> V. Filipov, D. Ceneda, D. Archambault and A. Arleo, "TimeLighting: Guided Exploration of 2D Temporal Network Projections," in IEEE Transactions on Visualization and Computer Graphics (2024), doi: 10.1109/TVCG.2024.3514858.



## Demonstration Video
[![TimeLighting Demonstration](https://img.youtube.com/vi/GqBbqNR07rA/0.jpg)](https://youtu.be/GqBbqNR07rA)

## Necessary Dependencies
This project requires [NodeJS](https://nodejs.org/en) and the [Angular CLI](https://github.com/angular/angular-cli) installed.

Alternatively, the project can be setup and deployed using Docker [Docker](https://www.docker.com/).

After installing NodeJS you can install the Angular CLI using the following code `npm i -g @angular/cli`.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.2.4 and [NodeJS](https://nodejs.org/en) version 20.

# Getting Started

## Linux & MacOS
### Bash script (*Nix Distributions & MacOS).

Copy and save the following script as ```timelighting.sh```

```bash
#!/bin/bash

# Check for Node.js 
if ! node -v > /dev/null 2>&1; then
    echo "Node.js is not installed. Please install it first."
    exit 1
else 
    echo "Node.js is installed. Version $(node -v)"
fi

# Check for Angular CLI
if ! ng version > /dev/null 2>&1; then
    echo "Angular CLI is not installed. Installing Angular CLI..."
    npm install -g @angular/cli
else
    echo "Angular CLI is installed. Version $(ng version)"
fi

# Clone the repository
if [ ! -d "temporal-graphs" ]; then
    echo "Cloning the repository..."
    git clone https://github.com/velitchko/timelighting.git
fi

# Navigate to the backend directory
cd temporal-graphs || { echo "Directory not found!"; exit 1; }

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Start the application
echo "Starting the application..."
npm run start
```

After make sure it has execution permissions and run the script.
It will check if you have NodeJS and Angular installed and clone the repository (if it doesn't exist), install all the dependencies, and run the application.
```bash
chmod +x ./timelighting.sh
sh ./timelighting.sh
```

## Windows
### BAT Script (Windows)
Copy and save the following script as ```timelighting.bat```

```bash
@echo off
setlocal enabledelayedexpansion

REM Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install it first.
    exit /b 1
) else (
    for /f "tokens=*" %%a in ('node -v') do set "NODE_VERSION=%%a"
    echo Node.js is installed. Version !NODE_VERSION!
)

REM Check for Angular CLI
where ng >nul 2>nul
if %errorlevel% neq 0 (
    echo Angular CLI is not installed. Installing Angular CLI...
    npm install -g @angular/cli
) else (
    REM Capture Angular CLI version more carefully
    for /f "tokens=3" %%a in ('ng version ^| findstr "Angular CLI:"') do set "NG_VERSION=%%a"
    echo Angular CLI is installed. Version !NG_VERSION!
)

REM Clone the repository
if not exist "temporal-graphs" (
    echo Cloning the repository...
    git clone https://github.com/velitchko/timelighting.git temporal-graphs
)

REM Navigate to the backend directory
cd temporal-graphs || (
    echo Directory not found!
    exit /b 1
)

REM Install dependencies
echo Installing dependencies...
start cmd /k "npm install --legacy-peer-deps"

REM Start the application
echo Starting the application...
start cmd /k "npm run start"
```

After that run the bat file by either double-clicking or executing it in a shell.
It will check if you have NodeJS and Angular installed and clone the repository (if it doesn't exist), install all the dependencies, and run the application.
```bash
timelighting.bat
```

## Local Setup

###
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
A step-by-sdtep guide to setup the TimeLighting with Docker: 

Note: Make sure you have [Docker](https://www.docker.com/) installed.

Build the container:
```console
foo@bar:~$ docker compose build
```
Start the container:
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

