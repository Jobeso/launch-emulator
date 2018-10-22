#!/usr/bin/env node

const program = require('commander')
const { spawn } = require('child_process')
const inquirer = require('inquirer')

const exitWithErrorMessage = message => {
  console.log('')
  console.log(message)
  process.exit(1)
}

const getAvailableOsWithDevices = (acc, curr) => {
  if (acc.currentDeviceSection && !curr.startsWith('--')) {
    const device = curr.match(/(.*)\s\(([a-zA-Z0-9-]+)\)\s\([a-zA-Z]+\)$/i)
    const isFirstArrayConstruction = acc.devices[acc.currentDeviceSection]

    return device
      ? {
          ...acc,
          devices: {
            ...acc.devices,
            [acc.currentDeviceSection]: isFirstArrayConstruction
              ? [
                  ...acc.devices[acc.currentDeviceSection],
                  { name: device[1], id: device[2] },
                ]
              : [{ name: device[1], id: device[2] }],
          },
        }
      : acc
  }

  const matchOsHeadline = curr.match(/^--\siOS\s([0-9.]+)\s--/)

  return matchOsHeadline
    ? { ...acc, currentDeviceSection: matchOsHeadline[1] }
    : { ...acc, currentDeviceSection: null }
}

const getAvailableEmulatorsData = data =>
  new Promise(resolve => {
    const outputArray = data
      .toString()
      .split('\n')
      .map(item => item.replace(/^ +(?=)/g, ''))

    const filteredOutput = outputArray.reduce(getAvailableOsWithDevices, {
      devices: {},
    })

    resolve(filteredOutput.devices)
  })

const chooseOsPrompt = ({ choices }) =>
  choices.length > 1
    ? inquirer.prompt([
        {
          type: 'list',
          name: 'chosenOs',
          message: 'Choose the OS you want to run:',
          choices,
          pageSize: 40,
        },
      ])
    : Promise.resolve({ chosenOs: choices[0] })

const chooseDevice = ({ choices }) =>
  inquirer.prompt([
    {
      type: 'list',
      name: 'chosenDevice',
      message: 'Choose the device you want to use:',
      choices,
      pageSize: 40,
    },
  ])

const run = () => {
  const cmd = spawn('xcrun', ['simctl', 'list'])

  cmd.stdout.on('data', data =>
    getAvailableEmulatorsData(data)
      .then(devices => {
        const availableOs = Object.keys(devices)

        if (availableOs.length) {
          chooseOsPrompt({
            choices: availableOs.reverse(),
          }).then(({ chosenOs }) =>
            chooseDevice({
              choices: devices[chosenOs].map(item => item.name),
            }).then(({ chosenDevice }) => {
              const device = devices[chosenOs].reduce(
                (acc, curr) => (curr.name === chosenDevice ? curr : acc),
                {}
              )

              if (!device.id) {
                exitWithErrorMessage("Couldn't find a matching emulator")
              }

              spawn('xcrun', ['simctl', 'boot', device.id])
              spawn('open', [
                '/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app',
              ])
            })
          )
        }
      })
      .catch(e => exitWithErrorMessage(e))
  )
}

program
  .version('0.1.0')
  .usage('launch-emulator')
  .action(run)
  .parse(process.argv)
