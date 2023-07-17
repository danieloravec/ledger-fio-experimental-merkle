# Experimental FIO Ledger App

Experimental FIO Ledger App for Ledger Nano S, that checks integrity of data after each step.

### What is optimized in this app

We have to decide whether we need to minimize the number of APDUs needed for
transaction signing, or minimize the number of hash operation (`sha_256_add`, `sha_256_finalize`).
As we experimented and got the following results, we will be trying to minimize the number of APDUs needed,
as time for a hashing operation is negligible as compared to the time of an average APDU:

`sha_256_init`:            0.000108
`sha_256_add`:             0.000770
`sha_256_finalize`:        0.001573
`APDU on average`:         0.168625


## Building

There are two ways how to build: local build and containerize build. Enviromental variable `BOLOS_SDK` determines the approach. If using local build it should contain directory containing SDK. If using containerize approach is should be empty.

Containerized approach is preferred. For containerized approach you need docker. For local build you need to setup the enviroment. Environment setup and developer documentation is sufficiently provided in Ledger’s [Read the Docs](https://developers.ledger.com/docs/nano-app/quickstart/).

Make sure you have:
- SDK >= 2.0.0 (for local build)
- MCU >= 1.11 (if you want to lead the app on the device)


### Building commands

To select device for which to build use enviromental variable `TARGET_DEVICE=NANO_S` (default), `TARGET_DEVICE=NANO_X`, or`TARGET_DEVICE=NANO_SP`.
To induce debug build set enviromental variable `DEVEL=1`. Thus, you can use: `TARGET_DEVICE=NANO_SP DEVEL=1 make`. 

Use the following commands:

`make` or `make build`
Builds the app, including Loading Tool.

`make all`
Builds the app, including app.hex and app.sha.256 file, excluding Loading Tool. Reqiuires ledgerblue python package.

`make clean`

`make format`

`make scan-build`

`make shell`
Starts the container and runs shell (only for container build)

`make size`
Determines the size of the app. 

Further interesting options are: `
- `NO_PULL=1`- do not pull containers (this works also for other commands using containers)
- `NO_INTEGRITY_CHECK=1` - integrity check is always ok, must also have `DEVEL=1`. If you run speculos tests you can obtain required integrity hashes from logs using `make get_integrity_hashes_from_logs`. You can copy them to signTransactionIntegrity.c . This is the easiest way to update integrity hash list after changes.


## Javascript layer

`make js-yarn`

`make js-prepack`

`make js-lint`

`make js-clean`

`make js-build`

`make js-build-flowtypes`

`make js-flow`

`make js-gen-docs`

`make js-prepublish`

`make js-run-example`
Runs an example app. Requires ledger to be connected and loaded with FIO app.


## Speculos emulator and emulator tests

Requires Docker. You need to set `TARGET_DEVICE` enviromental variable (if you do not want to emulate Nano S) is a similar way as when you build the app.

`make speculos_port_5001_start`
Starts the container. You can interact with it on ports:
- 5001: API port
    You can use this api to press buttons, take snapshots; besides this you can interact at http://localhost:5001/
- 40001: APDU port
    You may use SpeculosTransport class to communicate with the device via this port. Note that this transport can be injected into main js class.

`make speculos_port_5001_stop`
Stops the container

Further interesting options are: `
- `NO_PULL=1`- do not pull containers (this works also for other commands using containers)

### Running tests on Speculos

If you update JavaScript, you need to `make js-build` to compile it and then `make test-yarn` to update the dependency in tests.

`make test-yarn`
Prepares dependencies for speculos tests

`make speculos_port_5001_test`
Runs integration tests on Speculos. If screenshot change, then you need to set variable `TEST_PNG_RE_GEN_FOR`.
E.g. `TEST_PNG_RE_GEN_FOR=snapshots/getPublicKey.js make speculos_port_5001_test` runs tests and re-genetates screenshots 
for `getPublicKey.js` integration tests. `TEST_PNG_RE_GEN_FOR=snapshots make speculos_port_5001_test` regenerates all snapshots.

`make speculos_port_5001_unit_test`
Runs unit tests on Speculos. Requires DEVEL build.

Further interesting options are: `
- `NO_PULL=1`- do not pull containers (this works also for other commands using containers)

## Testing on physical device

### Setup

Make sure you have:
- SDK >= 2.0.0
- MCU >= 1.11

Environment setup and developer documentation is sufficiently provided in Ledger’s [Read the Docs](https://developers.ledger.com/docs/nano-app/quickstart/).

You want a debug version of the MCU firmware (but it blocks SDK firmware updates, so for the purpose of upgrading SDK, replace it temporarily with a non-debug one). Instructions for swapping MCU versions: https://github.com/LedgerHQ/ledger-dev-doc/blob/master/source/userspace/debugging.rst


### Troubleshooting connection problems

The quickstart guide's script sets up your udev rules, but there still might be problems.
- https://support.ledger.com/hc/en-us/articles/115005165269-Fix-connection-issues


### Loading the app

`make load`
Builds and loads the application into connected device. Just make sure to close the Ledger app on the device before running the command.

`make delete`
Deletes the application from connected device

`make seed`
Resets mnemonics and pin as desired to ones desired by test.
Many of our integration tests expect the device to be configured with a known test mnemonic.
- Plug your device while pressing the right button
- Your device will show "Recovery" in the screen
- Double click


### Running tests on real device

If you update JavaScript, you need to `make js-build` to compile it and then `make test-yarn` to update the dependency in tests.

If you do not want to click through all the screens you may, if you use DEVEL build set `HEADLESS`, e.g. `HEADLESS= make` 
At this moment we experience issues with PRINTF macro on ledger device thus you should only run `make ledger_test` on non-development build.

`make ledger_test`

`make ledger_unit_test`
This requires `DEVEL=1` app version.


## How to get a transaction body computed by Ledger (for development purposes)

If you use Speculos with `DEVEL=1` build, then you can find logs from `sha_256_append` function. Concatenating what went into hash computation gives the transaction body as signed by ledger.

## How to add a new type of action

The suggested method is the following:
1. Start writing speculos integration test for the new action until the point when you can retrieve necessary types ftom ABI. Add the new test to the list of tests in MakefileTest.mk. You may want to comment out all other tests durring first phase of the development.
2. Add new public type for the new action's data to ledgerjs-fio/src/types/public.ts . Do not forget to add the new type to Action definition. Add internal types for parsed action data to ledgerjs-fio/src/types/internal.ts . Again, do not forget to add the types ParsedAction definition.
3. Add action data parsing to ledgerjs-fio/src/utils/parseTxActions.ts .
4. Add action data parsing to ledgerjs-fio/src/utils/parse.ts .
5. Prepare transaction template in ledgerjs-fio/src/interaction/transactionTemplates . To get the right serialization you have to follow ABI obtained in step 1. Add the new template into the template list in ledgerjs-fio/src/interaction/transactionTemplates/template_all.ts
6. Build js and connect it with integration tests: `make js-build`, `make test-yarn`
7. Build integration tests for the new action. If the action allows for multiple workflows, all of them must be in integration tests, otherwise we will not get all necessary hashes in later steps.
8. Create a directory in test-integration/snapshots/ that matches the name of your test.
9. Build the NanoS app in devel mode that ignores integrity check: `make clean`, `NO_INTEGRITY_CHECK=1 DEVEL=1 make`.
10. Run Speculos integration tests, generating screenshots for the new test: `TEST_PNG_RE_GEN_FOR=snapshots make speculos_port_5001_test`. After this, the logs contain all necessary interity hashes.
11. Retrieve the integrity hashes from the logs `make get_integrity_hashes_from_logs`. Append the new ones (or if you ran all the tests replace the whole list) to the list of hashes in src/signTransactionIntegrity.c . Run `make format` to format the changes.
12. Build NanoS+ app `make clean`, `TARGET_DEVICE=NANO_SP make` and generate the snapshots for the new test `TEST_PNG_RE_GEN_FOR=snapshots TARGET_DEVICE=NANO_SP make speculos_port_5001_test` . Now the app is not in devel mode thus we validate that integrity hashes were added correctly. 
13. Review all snapshots. Uncomment tests you commented in MakefileTest.mk . You can either run all tests again lacally, or use CI to run all tests.






