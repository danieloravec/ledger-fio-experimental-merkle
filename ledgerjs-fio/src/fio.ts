/********************************************************************************
 *   Ledger Node JS API
 *   (c) 2016-2017 Ledger
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ********************************************************************************/
import type Transport from "@ledgerhq/hw-transport"
import { decodeMessage } from "./interactions/decodeMessage"

import { DeviceStatusCodes, DeviceStatusError, InvalidDataReason } from './errors'
import type { Interaction, SendParams } from './interactions/common/types'
import { getPublicKey } from "./interactions/getPublicKey"
import { getSerial } from "./interactions/getSerial"
import { getCompatibility, getVersion } from "./interactions/getVersion"
import { runTests } from "./interactions/runTests"
import { signTransaction } from "./interactions/signTransaction"
import { HexString, ParsedContext, ParsedTransaction, PUBLIC_KEY_LENGTH, ValidBIP32Path } from './types/internal'
import type { BIP32Path, DeviceCompatibility, Serial, SignedTransactionData, Transaction, Version } from './types/public'
import { stripRetcodeFromResponse } from "./utils"
import { assert } from './utils/assert'
import { isArray, parseBIP32Path, parseContext, parseHexString, parseMessage, parseTransaction, validate } from './utils/parse'

export * from './errors'
export * from './types/public'

const CLA = 0xd7

function wrapConvertDeviceStatusError<T extends Function>(fn: T): T {
    // @ts-ignore
    return async (...args) => {
        try {
            return await fn(...args)
        } catch (e: any) {
            if (e && e.statusCode) {
                throw new DeviceStatusError(e.statusCode)
            }
            throw e
        }
    }
}

/**
 * FIO API
 *
 * @example
 * import Fio from "@fioprotocol/fiojs";
 * const fio = new Fio(transport);
 */

/** @ignore */
export type SendFn = (params: SendParams) => Promise<Buffer>;

// It can happen that we try to send a message to the device
// when the device thinks it is still in a middle of previous ADPU stream.
// This happens mostly if host does abort communication for some reason
// leaving ledger mid-call.
// In this case Ledger will respond by ERR_STILL_IN_CALL *and* resetting its state to
// default. We can therefore transparently retry the request.

// Note though that only the *first* request in an multi-APDU exchange should be retried.
function wrapRetryStillInCall<T extends Function>(fn: T): T {
    // @ts-ignore
    return async (...args: any) => {
        try {
            return await fn(...args)
        } catch (e: any) {
            if (
                e &&
                e.statusCode &&
                e.statusCode === DeviceStatusCodes.ERR_STILL_IN_CALL
            ) {
                // Do the retry
                return await fn(...args)
            }
            throw e
        }
    }
}


async function interact<T>(
    interaction: Interaction<T>,
    send: SendFn,
): Promise<T> {
    let cursor = interaction.next()
    let first = true
    while (!cursor.done) {
        const apdu = cursor.value

        const start = Date.now();
        const res = first
            ? await wrapRetryStillInCall(send)(apdu)
            : await send(apdu)
        const end = Date.now();
        if (!first) {
            console.log(`APDU to device took: ${(end - start) / 1000} seconds.`);
        }
        first = false
        cursor = interaction.next(res)
    }
    return cursor.value
}

/**
 * Main API endpoint
 * @category Main
 */
export class Fio {
    /** @ignore */
    transport: Transport<string>;
    /** @ignore */
    _send: SendFn;

    constructor(transport: Transport<string>, scrambleKey: string = "FIO") {
        this.transport = transport
        // Note: this is list of methods that should "lock" the transport to avoid concurrent use
        const methods = [
            "getVersion",
            "getSerial",
            "getPublicKey",
            "signTransaction",
        ]
        this.transport.decorateAppAPIMethods(this, methods, scrambleKey)
        this._send = async (params: SendParams): Promise<Buffer> => {
            let response = await wrapConvertDeviceStatusError(this.transport.send)(
                CLA,
                params.ins,
                params.p1,
                params.p2,
                params.data,
            )
            response = stripRetcodeFromResponse(response)

            if (params.expectedResponseLength != null) {
                assert(
                    response.length === params.expectedResponseLength,
                    `unexpected response length: ${response.length} instead of ${params.expectedResponseLength}`,
                )
            }

            return response
        }
    }

    /**
     * Returns an object containing the app version.
     *
     * @returns Result object containing the application version number.
     *
     * @example
     * const { major, minor, patch, flags } = await fio.getVersion();
     * console.log(`App version ${major}.${minor}.${patch}`);
     *
     */
    async getVersion(): Promise<GetVersionResponse> {
        const version = await interact(this._getVersion(), this._send)
        return { version, compatibility: getCompatibility(version) }
    }

    /** @ignore */
    * _getVersion(): Interaction<Version> {
        return yield* getVersion()
    }

    /**
     * Returns an object containing the device serial number.
     *
     * @returns Result object containing the device serial number.
     *
     * @example
     * const { serial } = await fio.getSerial();
     * console.log(`Serial number ${serial}`);
     *
     */
    async getSerial(): Promise<GetSerialResponse> {
        return interact(this._getSerial(), this._send)
    }

    /** @ignore */
    * _getSerial(): Interaction<GetSerialResponse> {
        const version = yield* getVersion()
        return yield* getSerial(version)
    }

    /**
     * Get public key for the specified BIP 32 path.
     *
     * @returns The public key.
     *
     * @example
     * ```
     * const publicKey = await fio.getPublicKey[[ HARDENED + 44, HARDENED + 235, HARDENED + 0, 0, 0 ]);
     * console.log(publicKey);
     * ```
     * @see [[GetPublicKeyRequest]]
     */
    async getPublicKey(
        { path, show_or_not }: GetPublicKeyRequest
    ): Promise<GetPublicKeyResponse> {
        // validate the input
        validate(isArray(path), InvalidDataReason.GET_PUB_KEY_PATH_IS_NOT_ARRAY)
        const parsedPath = parseBIP32Path(path, InvalidDataReason.INVALID_PATH)

        return interact(this._getPublicKey(parsedPath, show_or_not), this._send)
    }

    /** @ignore */
    * _getPublicKey(path: ValidBIP32Path, show_or_not: boolean) {
        const version = yield* getVersion()
        return yield* getPublicKey(version, path, show_or_not)
    }

    /**
     * Sign transaction.
     *
     * @returns Hash and a list of Witnesses
     *
     * @example
     * ```
     * const sign = await fio.signTransaction({path, chainId, tx});
     * console.log(sign);
     * @see [[SignTransactionRequest]]
     * @see [[SignTransactionResponse]]
 * ```
     */
    async signTransaction({ path, chainId, tx }: SignTransactionRequest): Promise<SignTransactionResponse> {
        const parsedChainId = parseHexString(chainId, InvalidDataReason.INVALID_CHAIN_ID)
        const parsedPath = parseBIP32Path(path, InvalidDataReason.INVALID_PATH)
        const parsedTx = parseTransaction(parsedChainId, tx)
        return interact(this._signTransaction(parsedPath, parsedChainId, parsedTx), this._send)
    }

    /** @ignore */
    * _signTransaction(parsedPath: ValidBIP32Path, chainId: HexString, tx: ParsedTransaction) {
        const version = yield* getVersion()
        return yield* signTransaction(version, parsedPath, chainId, tx)
    }

    /**
     * Decode mesage encoded using DH shared cypher.
     *
     * @returns Decoded message
     *
     * @example
     * ```
     * const decoded = await fio.getPublicKey[[ HARDENED + 44, HARDENED + 235, HARDENED + 0, 0, 0 ], chainId, tx);
     * console.log(sign);
     * @see [[DecodeMessageRequest]]
     * @see [[DecodeMessageResponse]]
 * ```
     */
    async decodeMessage({ path, publicKeyHex, message, context }: DecodeMessageRequest): Promise<DecodeMessageResponse> {
        const parsedPath = parseBIP32Path(path, InvalidDataReason.INVALID_PATH)
        const parsedPubkey = parseHexString(publicKeyHex, InvalidDataReason.INVALID_PUBLIC_KEY, PUBLIC_KEY_LENGTH, PUBLIC_KEY_LENGTH)
        const parsedMessage = parseMessage(message, InvalidDataReason.INVALID_MESSAGE)
        const parsedContext = parseContext(context, InvalidDataReason.INVALID_CONTEXT)
        return interact(this._decodeMessage(parsedPath, parsedPubkey, parsedMessage, parsedContext), this._send)
    }

    /** @ignore */
    * _decodeMessage(parsedPath: ValidBIP32Path, pubkey: HexString, message: HexString, context: ParsedContext) {
        const version = yield* getVersion()
        return yield* decodeMessage(version, parsedPath, pubkey, message, context)
    }

    /**
     * Runs unit tests on the device (DEVEL app build only)
     */
    async runTests(): Promise<void> {
        return interact(this._runTests(), this._send)
    }

    /** @ignore */
    * _runTests(): Interaction<void> {
        const version = yield* getVersion()
        return yield* runTests(version)
    }

}

/**
 * Get FIO app version [[Fio.getVersion]] response data
 * @category Main
 * @see [[DeviceCompatibility]]
 */
export type GetVersionResponse = {
    version: Version
    compatibility: DeviceCompatibility
}

/**
 * Get device serial number ([[Fio.getSerial]]) response data
 * @category Main
 * @see [[Serial]]
 */
export type GetSerialResponse = Serial

/**
 * Get public key ([[Fio.getPublicKey]]) request data
 * @category Main
 * @see [[GetPublicKeyResponse]]
 */
export type GetPublicKeyRequest = {
    /** Path to public key which should be derived by the device */
    path: BIP32Path
    /** Show pubkey on the device or not */
    show_or_not: boolean,
}

/**
 * Get public key ([[Fio.getPublicKey]]) response data
 * @category Main
 * @see [[GetPublicKeyRequest]]
 */
export type GetPublicKeyResponse = {
    publicKeyHex: string,
    publicKeyWIF: string
}

/**
 * Sign transaction ([[Fio.signTransaction]]) request data
 * @category Main
 * @see [[SignTransactionResponse]]
 * @see [[Transaction]]
 */
export type SignTransactionRequest = {
    /** Path to public key used to sign the transaction */
    path: BIP32Path,
    /** ChainId in hex format */
    chainId: string,
    /** Transaction to sign */
    tx: Transaction,
}

/**
 * Sign transaction ([[Fio.signTransaction]]) response data
 * @category Main
 * @see [[SignTransactionRequest]]
 * @see [[SignedTransactionData]]
 */
export type SignTransactionResponse = SignedTransactionData

/**
 * Sign transaction ([[Fio.signTransaction]]) request data
 * @category Main
 * @see [[DecodeMessageResponse]]
 */
export type DecodeMessageRequest = {
    /** Path to public key used to decode the message */
    path: BIP32Path,
    /** Other public key in raw hex format*/
    publicKeyHex: string,
    /** Base64 encoded message */
    message: string,
    /** Message context, either "newfundsreq" or "recordobt" */
    context: string,
}

/**
 * Sign transaction ([[Fio.signTransaction]]) response data
 * @category Main
 * @see [[DecodeMessageRequest]]
 */
export type DecodeMessageResponse = {
    /** Decoded message */
    message: Buffer,
}

export default Fio
