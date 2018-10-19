#!/usr/bin/env node

const program = require('commander')
const { spawn } = require('child_process')
const inquirer = require('inquirer')

const getDevices = (acc, curr) => {
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

  const match = curr.match(/^--\siOS\s([0-9.]+)\s--/)
  return match
    ? { ...acc, currentDeviceSection: match[1] }
    : { ...acc, currentDeviceSection: null }
}

const getEmulatorData = data =>
  new Promise(resolve => {
    const outputArray = data
      .toString()
      .split('\n')
      .map(item => item.replace(/^ +(?=)/g, ''))

    const filteredOutput = outputArray.reduce(getDevices, { devices: {} })

    resolve(filteredOutput.devices)
  })

const run = () => {
  const cmd = spawn('xcrun', ['simctl', 'list'])

  cmd.stdout.on('data', data =>
    getEmulatorData(data)
      .then(devices => {
        if (Object.keys(devices).length) {
          inquirer
            .prompt([
              {
                type: 'list',
                name: 'chosenOS',
                message: 'Choose the OS you want to run:',
                choices: Object.keys(devices).reverse(),
                pageSize: 40,
              },
            ])
            .then(({ chosenOS }) =>
              inquirer
                .prompt([
                  {
                    type: 'list',
                    name: 'chosenDevice',
                    message: 'Choose the device you want to use:',
                    choices: devices[chosenOS].map(item => item.name),
                    pageSize: 40,
                  },
                ])
                .then(({ chosenDevice }) => {
                  const device = devices[chosenOS].reduce(
                    (acc, curr) => (curr.name === chosenDevice ? curr : acc),
                    {}
                  )

                  spawn('xcrun', ['simctl', 'boot', device.id])
                  spawn('open', [
                    '/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app',
                  ])
                })
            )
        }
      })
      .catch(e => (console.error(e), process.exit(1)))
  )
}

program
  .version('0.1.0')
  .usage('./launchEmulator.js')
  .action(run)
  .parse(process.argv)
