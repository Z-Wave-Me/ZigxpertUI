var configurationCommandsModule = angular.module('appConfigurationCommands', ['dataHolderModule', 'appService']);

configurationCommandsModule.service('configurationCommandsService', ['dataHolderService', 'deviceService', '$interval', 'cfg', '$rootScope', function (dataHolderService, deviceService, $interval, cfg, $rootScope) {
  const self = this;
  self.ccTable = {};
  var _methods_specs_rendered = null;
  function groupBy(arr, field){
    return arr?.reduce((acc, cur) => {
      const {[field]: key, ...other} = cur;
      return {...acc, [key]: acc[key] ? [...acc[key], other] : [other]}
    }, {});
  }
  /**
   * @typedef {string} cluster
   * @return {{cluster: {[values]: string[], [arrays]: string[]}}}
   */
  var serverCommands = function () {
    return {
      /*
        values: ['name1', 'name2']
        arrays: ['name1', 'name2']
        arraysInArrays: ['name1', 'name2']
      */
      OnOff: {
        values: ['onOff', 'globalSceneControl', 'onTime', 'offWaitTime']
      },
      LevelControl: {
        values: ['currentLevel', 'remainingTime', 'onOffTransitionTime', 'onLevel', 'onTransitionTime', 'offTransitionTime']
      },
      ColorControl: {
        values: ['currentHue', 'currentSaturation', 'remainingTime', 'colorMode']
      },
      IasZone: {
        values: ['zoneState', 'zoneType', 'zoneStatus', 'zoneId', 'CurrentZoneSensitivityLevel'],
      },
      PollControl: {
        values: ['checkInInterval', 'longPollInterval', 'shortPollInterval', 'fastPollTimeout', 'checkInIntervalMin', 'shortPollIntervalMin', 'fastPollTimeoutMax']
      },
      DoorLock: {
        values: ['lockState', 'lockType', 'actuatorEnabled', 'doorState', 'doorOpenEvents', 'doorClosedEvents', 'openPeriod', 'enableLogging', 'ledSettings', 'autoRelockTime', 'soundVolume', 'operatingMode', 'enableOneTouchLocking', 'enableInsideStatusLED', 'enablePrivacyModeButton', 'wrongCodeEntryLimit', 'userCodeTemporaryDisableTime', 'sendPINOverTheAir', 'requirePINforRFOperation', 'zigBeeSecurityLevel', 'alarmMask', 'keypadOperationEventMask', 'rfOperationEventMask', 'manualOperationEventMask', 'rfidOperationEventMask', 'keypadProgrammingEventMask', 'rfProgrammingEventMask', 'rfidProgrammingEventMask']
      },
      Alarm: {
        arrays: ['alarmTable', 'alarmCode', 'clusterId', 'timeStamp']
      }
    }
  }
  function nodeProperty() {
    return [
      {
        "label": "givenName",
        "type": {
          "string": {}
        },
        "defaultValue": "new name"
      }
    ]
  }

  this.serverCommand = function (cluster) {
    return serverCommands()[cluster] ?? {};
  }
  const commandConverter = (data) => ({
    type: {
      [data.format.value === 'bitmask' ? 'bitmask' : 'range']: {
        max: data.max.value,
        min: data.min.value,
        size: data.size.value
      }
    },
    default: data.default.value,
    title: data.title.value,
    description: data.description.value,
    readonly: data.readonly.value,
    failed: data.val.updateTime > data.val.invalidateTime,
    value: data.val.value,
    updateTime: data.val.updateTime,
    path: `devices[${self.nodeId}].endpoints[0].clusters[112]`
  });

  this.getConfigCommands = function (nodeId) {
    return Object.entries(dataHolderService.getRealNodeById(nodeId).endpoints[0].clusters[112].data)
      .filter(([key]) => Number.isInteger(+key)).map(([key, data]) => ({...commandConverter(data), index: +key}))
  }
  this.node = function () {
    const device = dataHolderService.getRealNodeById(self.nodeId).data;
    self.ccTable[`${self.nodeId}@Property`] = {
      table: nodeProperty().reduce((acc, cur) => {
        return {...acc, [cur.label]: [{
          data: device[cur.label]?.value,
            key: cur.label,
            updateTime: device[cur.label]?.updateTime,
            isUpdated: device[cur.label]?.updateTime > device[cur.label]?.invalidateTime,
            value: device[cur.label]?.value,
            cmd: `devices[${self.nodeId}].data.${cur.label}.value`
          }]
      }
      }, {})
    };
    return {
      name: dataHolderService.getRealNodeById(self.nodeId).data.givenName.value,
      path: `devices[${self.nodeId}]`,
      properties: Object
      .fromEntries(nodeProperty().map(entry => ([entry.label, {accessor: 'nodeProperty',
        fields: [entry]}])))
    }
  }
  this.getCommands = function (nodeId) {
    return dataHolderService.update().then(() => {
      const node = dataHolderService.getRealNodeById(nodeId);
      if (!node) throw new Error('No Device');
      return Object.entries(node.endpoints).reduce((acc, [endpointId, endpoint]) => {
        const classCommands = Object.entries(endpoint.clusters)
          .reduce((acc, [ccId, {data, name}]) => {
            const methods = configureCommand(ccId, data);
            const values = valueExtractor(data, self.serverCommand(name),
                `devices[${nodeId}].endpoints[${endpointId}].clusters[${ccId}].data`);
            acc.push({
              ccId: +ccId,
              name,
              methods,
              visible: !!Object.keys(methods).length || !!Object.keys(values).length,
              endpoint: +endpointId,
              path: `devices[${nodeId}].endpoints[${endpointId}].clusters[${ccId}]`,
              version: data.version.value,
            })
            self.ccTable[`${name}@${endpointId}`] = {
              endpointId: +endpointId,
              ccId: +ccId,
              name,
              data,
              nodeData: endpoint.data,
              updateTime: node.data.updateTime,
              table: values
            };
            return acc;
          }, [])
        return [...acc, ...classCommands];
      }, []);
    });
  }

  function updateCcTable(node) {
      self.ccTable[`${self.nodeId}@Property`] = {
        table: nodeProperty().reduce((acc, cur) => {
          return {...acc, [cur.label]: [{
              data: node.data[cur.label]?.value,
              key: cur.label,
              updateTime: node.data[cur.label]?.updateTime,
              isUpdated: node.data[cur.label]?.updateTime > node.data[cur.label]?.invalidateTime,
              cmd: `devices[${self.nodeId}].data.${cur.label}.value`
            }]
          }
        }, {})
    }
    Object.entries(node.endpoints).map(([endpointId, endpoint]) => {
      Object.entries(endpoint.clusters)
        .map(([ccId, {data, name}]) => {
          self.ccTable[`${name}@${endpointId}`] = {
            endpointId,
            ccId,
            name,
            data,
            nodeData: endpoint.data,
            updateTime: node.data.updateTime,
            table: valueExtractor(data, self.serverCommand(name),
              `devices[${self.nodeId}].endpoints[${endpointId}].clusters[${ccId}].data`)
          };
        })
    })
  }
  function packIt(targetField, data, key, value, cmd) {
    return {
      targetField,
      data: value.value,
      key,
      updateTime: value.updateTime,
      isUpdated: value.updateTime > value.invalidateTime,
      cmd
    }
  }

  function valueExtractor(data, {values, arrays, arraysInArrays}, baseCmd) {
    return groupBy(Object.entries(data).map(([key, value]) => {
      if (isNaN(+key)) {
        return values?.filter(targetField => targetField === key).map(targetField => {
          return packIt(targetField, data, key, value, `${baseCmd}.${targetField}.value`);
        })
      } else {
        if (arraysInArrays) {
          return Object.entries(value).map(([_key, value]) => {
            if (!value) return [];
            return Object.entries(value).map(([__key, value]) => {
              return arraysInArrays.filter(targetField => targetField === __key).map((targetField) => {
                return packIt(targetField, data, key + "." + _key, value, `${baseCmd}[${key}][${_key}].${targetField}.value`);
              })
            }).flat()
          }).flat()
        }
        return Object.entries(value).map(([_key, value]) => {
          return arrays?.filter(targetField => targetField === _key).map((targetField) => {
            return packIt(targetField, data, key, value, `${baseCmd}[${key}].${targetField}.value`);
          })
        }).flat()
      }
    }).flat().filter(data => data), 'targetField');
  }

  let dataUpdate = null

  this.init = function (nodeId) {
    self.nodeId = nodeId;
    return self.getCommands(nodeId).then((commands) => {
      $rootScope.$broadcast('configuration-commands:cc-table:update', self.ccTable);
      dataUpdate = $rootScope.$on('configuration-commands:zigbee-data:update', function (_, {ids, data}) {
        if (ids.has(self.nodeId)) {
          updateCcTable(data.devices[self.nodeId])
          $rootScope.$broadcast('configuration-commands:cc-table:update', self.ccTable);
        }
      });
      return commands;
    })
  }


  this.destroy = function () {
    if (dataUpdate) {
     dataUpdate();
   }
  }
  function configureCommand(ccId, clustersData) {
    return Object.entries(renderMethodSpec(parseInt(ccId, 10), clustersData))
      .reduce((acc, [name, data]) => {
        const accessor = Array.isArray(data) ? 'method': 'property';
        const fields = accessor === 'method' ? data : [data];
        acc[name] = {
          accessor,
          fields,
        }
        return acc;
      }, {})
  }

  function renderAllMethodSpec(ZigbeeAPIData) {
    _methods_specs_rendered = {};

    for (var devId in ZigbeeAPIData.devices) {
      _methods_specs_rendered[devId] = {};
      for (var instId in ZigbeeAPIData.devices[devId].endpoints) {
        _methods_specs_rendered[devId][instId] = {};
        for (var ccId in ZigbeeAPIData.devices[devId].endpoints[instId].clusters) {
          _methods_specs_rendered[devId][instId][ccId] = renderMethodSpec(parseInt(ccId, 10), ZigbeeAPIData.devices[devId].endpoints[instId].clusters[ccId].data);
        }
      }
    }
  }

  function renderMethodSpec(ccId, data) {
    switch (ccId) {
      // Basic
      case 0x0000:
        return {
          "ConfigurationGet": [],
          "Reset": []
        };

      // Identify
      case 0x0003:
        return {
          "Identify": [
            {
              "label": "Identify",
              "type": {
                "enumof": [
                  {
                    "label": "Start",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label" : "in seconds",
                    "type": {
                      "range": {
                        "min": 1,
                        "max": 65535
                      }
                    }
                  }
                ]
              }
            }
          ],
          "IdentifyQuery": [],
          "TriggerEffect": [
            {
              "label": "Effect Identifyer",
              "type": {
                "enumof": [
                  {
                    "label": "Blink",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Breathe",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  },
                  {
                    "label": "Okay",
                    "type": {
                      "fix": {
                        "value": 2
                      }
                    }
                  },
                  {
                    "label": "Channel change",
                    "type": {
                      "fix": {
                        "value": 11
                      }
                    }
                  },
                  {
                    "label": "Finish effect",
                    "type": {
                      "fix": {
                        "value": 254
                      }
                    }
                  },
                  {
                    "label": "Stop effect",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Effect Variant",
              "type": {
                "enumof": [
                  {
                    "label": "Default",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "variable",
                    "type": {
                      "range": {
                        "min": 0,
                        "max": 255
                      }
                    }
                  }
                ]
              }
            }
          ],
          "SetIdentifyTime": [
            {
              "label": "Identify Time",
              "type": {
                "range": {
                  "min": 0,
                  "max": 65535
                }
              }
            }
          ],
          "Get": []
        };
      
      // OnOff
      case 0x0006:
        return {
          "Get": [],
          "Toggle": [],
          "Set": [
            {
              "label": "Level",
              "type": {
                "enumof": [
                  {
                    "label": "Off",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "On",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  }
                ]
              }
            }
          ],
          "OffWaitTime": [
            {
              "label": "Effect Identifier",
              "type": {
                "enumof": [
                  {
                    "label": "Delayed All Off",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Dying Light",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Effect Variable",
              "type": {
                "enumof": [
                  {
                    "label": "Fade to off in 0.8 seconds",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "No Fade",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  },
                  {
                    "label": "50% dim down in 0.8 seconds then fade to off in 12 seconds",
                    "type": {
                      "fix": {
                        "value": 2
                      }
                    }
                  },
                  {
                    "label": "20% dim up in 0.5s then fade to off in 1 second",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  } 
                ]
              }
            }
          ],
          "RecallGlobalScene": [],
          "OnWithTimedOff": [
            {
              "label": "Control",
              "type": {
                "enumof": [
                  {
                    "label": "Accept Only When On",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Decline",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "On time in 1/10 seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 65534
                }
              }
            },
            {
              "label": "Off wait time in 1/10 seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 65534
                }
              }
            }
          ],
          "SetOnTime": [
            {
              "label": "in 1/10 seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 65534
                }
              }
            }
          ],
          "SetOffWaitTime": [
            {
              "label": "in 1/10 seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 65534
                }
              }
            }
          ],
          "Get": [],
          "ConfigurationGet": []
        };

      // LevelControl
      case 0x0008:
        return {
          "MoveToLevel": [
            {
              "label": "Level",
              "type": {
                "enumof": [
                  {
                    "label": "Off",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Level",
                    "type": {
                      "range": {
                        "min": 0,
                        "max": 255
                      }
                    }
                  },
                  {
                    "label": "Full",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Duration",
              "type": {
                "enumof": [
                  {
                    "label": "immediately",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "in seconds",
                    "type": {
                      "range": {
                        "min": 1,
                        "max": 65534
                      }
                    }
                  },
                  {
                    "label": "immediately",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  }
                ]
              }
            }
          ],
          "Move": [
            {
              "label": "Move Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Rate",
              "type": {
                "enumof": [
                  {
                    "label": "Default",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  },
                  {
                    "label": "in units per second",
                    "type": {
                      "range": {
                        "min": 0,
                        "max": 254
                      }
                    }
                  }
                ]
              }
            }
          ],
          "Step": [
            {
              "label": "Step Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Step Size",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            }
          ],
          "Stop": [],
          "MoveToLevelOnOff": [
            {
              "label": "Level",
              "type": {
                "enumof": [
                  {
                    "label": "Off",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Level",
                    "type": {
                      "range": {
                        "min": 0,
                        "max": 255
                      }
                    }
                  },
                  {
                    "label": "Full",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Duration",
              "type": {
                "enumof": [
                  {
                    "label": "immediately",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "in seconds",
                    "type": {
                      "range": {
                        "min": 1,
                        "max": 65534
                      }
                    }
                  },
                  {
                    "label": "immediately",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  }
                ]
              }
            }
          ],
          "MoveOnOff": [
            {
              "label": "Move Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Rate",
              "type": {
                "enumof": [
                  {
                    "label": "Default",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  },
                  {
                    "label": "in units per second",
                    "type": {
                      "range": {
                        "min": 0,
                        "max": 254
                      }
                    }
                  }
                ]
              }
            }
          ],
          "StepOnOff": [
            {
              "label": "Step Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Step Size",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            }
          ],
          "StopOnOff": [],
          "Get": [],
          "ConfigurationGet": []
        };
      
      // PollControl
      case 0x0020:
        return {
          "FastPollStop": [],
          "SetLongPollInterval": [
            {
              "label": "Long Poll Interval",
              "type": {
                "range": {
                  "min": 4,
                  "max": 7208960
                }
              }
            }
          ],
          "ConfigurationGet": []
        };

      // ColorControl
      case 0x0300:
        return {
          "MoveToHue": [
            {
              "label": "Hue",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Direction",
              "type": {
                "enumof": [
                  {
                    "label": "Shortest distance",
                    "type": {
                      "fix": {
                        "value": 0
                      } 
                    }
                  },
                  {
                    "label": "Longest distance",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 2
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "MoveHue": [
            {
              "label": "Move Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Stop",
                    "type": {
                      "fix": {
                        "value": 0
                      } 
                    }
                  },
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Rate",
              "type": {
                "range": {
                  "min": 1,
                  "max": 255
                }
              }
            }
          ],
          "StepHue": [
            {
              "label": "Step Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Steps Size",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "MoveToSaturation": [
            {
              "label": "Hue",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "MoveSaturation": [
            {
              "label": "Move Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Stop",
                    "type": {
                      "fix": {
                        "value": 0
                      } 
                    }
                  },
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "steps per second",
              "type": {
                "range": {
                  "min": 1,
                  "max": 255
                }
              }
            }
          ],
          "StepSaturation": [
            {
              "label": "Step Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Steps Size",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Transition Time in 1/10 seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            }
          ],
          "MoveToHueAndSaturation": [
            {
              "label": "Hue",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Saturation",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "MoveToColor": [
            {
              "label": "ColorX",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "ColorY",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "MoveColor": [
            {
              "label": "RateX",
              "type": {
                "range": {
                  "min":  -(256*256) / 2 + 1,
                  "max": (256*256) / 2 - 1
                }
              }
            },
            {
              "label": "RateY",
              "type": {
                "range": {
                  "min":  -(256*256) / 2 + 1,
                  "max": (256*256) / 2 - 1
                }
              }
            }
          ],
          "StepColor": [
            {
              "label": "RateX",
              "type": {
                "range": {
                  "min":  -(256*256) / 2 + 1,
                  "max": (256*256) / 2 - 1
                }
              }
            },
            {
              "label": "RateY",
              "type": {
                "range": {
                  "min":  -(256*256) / 2 + 1,
                  "max": (256*256) / 2 - 1
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "MoveToColorTemperature": [
            {
              "label": "ColorTemperatureMireds",
              "type": {
                "range": {
                  "min":  0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "EnhancedMoveToHue": [
            {
              "label": "Enhanced Hue",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Direction",
              "type": {
                "enumof": [
                  {
                    "label": "Shortest distance",
                    "type": {
                      "fix": {
                        "value": 0
                      } 
                    }
                  },
                  {
                    "label": "Longest distance",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 2
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "EnhancedMoveHue": [
            {
              "label": "Move Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Stop",
                    "type": {
                      "fix": {
                        "value": 0
                      } 
                    }
                  },
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Rate",
              "type": {
                "range": {
                  "min": 1,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "EnhancedStepHue": [
            {
              "label": "Step Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Steps Size",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "EnhancedMoveToHueAndSaturation": [
            {
              "label": "Enhanced Hue",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Saturation",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "ColorLoopSet": [
            {
              "label": "UpdateFlags",
              "type": {
                "enumof": [
                  {
                    "label": "Update Action",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  },
                  {
                    "label": "Update Direction",
                    "type": {
                      "fix": {
                        "value": 2
                      }
                    }
                  },
                  {
                    "label": "Update Time",
                    "type": {
                      "fix": {
                        "value": 4
                      }
                    }
                  },
                  {
                    "label": "Update Start Hue",
                    "type": {
                      "fix": {
                        "value": 8
                      }
                    }
                  },
                  {
                    "label": "Flags",
                    "type": {
                      "range": {
                        "min": 1,
                        "max": 15
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Action",
              "type": {
                "enumof": [
                  {
                    "label": "De-activate the color loop",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Activate the color loop from the value in the ColorLoopStartEnhancedHue field",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  },
                  {
                    "label": "Activate the color loop from the value of the EnhancedCurrentHue attribute",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Direction",
              "type": {
                "enumof": [
                  {
                    "label": "Decrement",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Increment",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Time in seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Start Hue",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "StopMoveStep": [],
          "MoveColorTemperature": [
            {
              "label": "Move Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Stop",
                    "type": {
                      "fix": {
                        "value": 0
                      } 
                    }
                  },
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Rate",
              "type": {
                "range": {
                  "min": 1,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Color Temperature Minimum Mireds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Color Temperature Maximum Mireds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "StepColorTemperature": [
            {
              "label": "Step Mode",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 1
                      } 
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 3
                      } 
                    }
                  }
                ]
              }
            },
            {
              "label": "Step Size",
              "type": {
                "range": {
                  "min": 1,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Transition Time in 1/10th of second",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Color Temperature Minimum Mireds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "Color Temperature Maximum Mireds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            }
          ],
          "GetHueSaturation": [],
          "GetColor": [],
          "GetRemainingTime": []
        };

      // DoorLock
      case 0x0101:
        return {
          "DoorLock": [
            {
              "label": "PIN Code",
              "type": {
                "string": {}
              }
            }
          ],
          "DoorUnlock": [
            {
              "label": "PIN Code",
              "type": {
                "string": {}
              }
            }
          ],
          "Toggle": [
            {
              "label": "PIN Code",
              "type": {
                "string": {}
              }
            }
          ],
          "UnlockWithTimeout": [
            {
              "label": "Timeout in seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 256*256 - 1
                }
              }
            },
            {
              "label": "PIN Code",
              "type": {
                "string": {}
              }
            }
          ],
          "GetLogRecord": [
            {
              "label": "Log Index",
              "type": {
                "range": {
                  "min": 0,
                  "max": ( 
                    function () {
                      try {
                        value  = data.numberOfLogRecordsSupported ? data.numberOfLogRecordsSupported.value - 1 : 0;
                        return value;
                      } catch (err) {
                      }
                      return 0;
                    }
                  )()
                }
              }
            }
          ],
          "GetState": [],
          "ConfigurationGet": []
        };

      // IasZone
      case 0x0500:
        return {
          "InitiateNormalOperationMode": [],
          "InitiateTestMode": [
            {
              "label": "Test Mode Duration in seconds",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            },
            {
              "label": "Current Zone Security Level",
              "type": {
                "enumof": [
                  {
                    "label": "Default",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "level",
                    "type": {
                      "range": {
                        "min": 0,
                        "max": ( 
                          function () {
                            try {
                              value  = data.numberOfZoneSensitivityLevelsSupported ? data.numberOfZoneSensitivityLevelsSupported : 0;
                              return value;
                            } catch (err) {
                            }
                            return 0;
                          }
                        )()
                      }
                    }
                  }
                ]
              }
            }
          ],
          "Enroll": [
            {
              "label": "Zone Identifier",
              "type": {
                "range": {
                  "min": 0,
                  "max": 255
                }
              }
            }
          ],
          "Get": [],
          "ConfigurationGet": []
        };
      
      default:
        return {};
    }
  }

  // device filter for device select menu
  function devicesHtmlSelectFilter(ZigbeeAPIData, span, dev, type) {
    // return true means to skip this node
    switch (type) {
      case 'srcnode':
        // allow everything, since events can come from any device via timed_event
        return false;

      case 'dstnode':
        // skip not controller
        return dev != ZigbeeAPIData.controller.data.nodeId.value;

      case 'device':
        return dev == ZigbeeAPIData.controller.data.nodeId.value;

      case 'node':
        // skip sleeping in list of associations/wakeup node notifications/... in CC params of type node
        return ZigbeeAPIData.devices[dev].data.isSleepy.value;

      default:
        return false;
    }
  }

  // returns array with default values: first value from the enum, minimum value for range, empty string for string, first nodeId for node, default schedule for the climate_schedule
  function methodDefaultValues(ZigbeeAPIData, method) {

    function methodDefaultValue(val) {
      if ('enumof' in val['type']) {
        if (val['type']['enumof'][0])
          return methodDefaultValue(val['type']['enumof'][0]); // take first item of enumof
        else
          return null;
      }
      if ('range' in val['type'])
        return val['type']['range']['min'];
      if ('fix' in val['type'])
        return val['type']['fix']['value'];
      if ('string' in val['type'])
        return "";
      if ('node' in val['type'])
        for (var dev in ZigbeeAPIData.devices) {
          if (devicesHtmlSelectFilter(ZigbeeAPIData, null, dev, 'node')) {
            continue;
          }
          return parseInt(dev);
        }
      alert('method_defaultValue: unknown type of value');
    }

    var parameters = [];
//	method.forEach(function(val,parameter_index){
//		parameters[parameter_index] = method_defaultValue(val);
//	});
    angular.forEach(method, function (val, parameter_index) {
      parameters[parameter_index] = methodDefaultValue(val);
    });

    return parameters;
  }

// represent array with number, string and array elements in reversible way: use eval('[' + return_value + ']') to rever back to an array
//   function reprArray(arr) {
//     var repr = '';
//     for (var index in arr) {
//       if (repr !== '')
//         repr += ',';
//       switch (typeof (arr[index])) {
//         case 'number':
//           repr += arr[index].toString();
//           break;
//         case 'string':
//           repr += "'" + arr[index].replace(/'/g, "\'") + "'"; // " // just for joe to hilight syntax properly
//           break;
//         case 'object':
//           repr += '[' + reprArray(arr[index]) + ']';
//           break;
//         default:
//           if (arr[index] === null)
//             repr += 'null'; // for null object
//           else
//             error_msg('Unknown type of parameter: ' + typeof (arr[index]));
//       }
//     }
//
//     return repr;
//   }

}])
