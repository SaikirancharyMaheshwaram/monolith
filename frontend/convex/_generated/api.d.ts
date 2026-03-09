/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_getChallenge from "../auth/getChallenge.js";
import type * as auth_verifyWallet from "../auth/verifyWallet.js";
import type * as duels_cancelOpenDuel from "../duels/cancelOpenDuel.js";
import type * as duels_computeOutcome from "../duels/computeOutcome.js";
import type * as duels_createFriendDuel from "../duels/createFriendDuel.js";
import type * as duels_finalizeSettlement from "../duels/finalizeSettlement.js";
import type * as duels_getActiveDuels from "../duels/getActiveDuels.js";
import type * as duels_getDuelById from "../duels/getDuelById.js";
import type * as duels_getDuelProgress from "../duels/getDuelProgress.js";
import type * as duels_getOpenDuels from "../duels/getOpenDuels.js";
import type * as duels_getProgramConfig from "../duels/getProgramConfig.js";
import type * as duels_getScheduledDuels from "../duels/getScheduledDuels.js";
import type * as duels_getUserByWallet from "../duels/getUserByWallet.js";
import type * as duels_getUserDuels from "../duels/getUserDuels.js";
import type * as duels_helpers from "../duels/helpers.js";
import type * as duels_joinFriendDuel from "../duels/joinFriendDuel.js";
import type * as duels_prepareSettlement from "../duels/prepareSettlement.js";
import type * as duels_startDuel from "../duels/startDuel.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_sha from "../lib/sha.js";
import type * as lib_signPayload from "../lib/signPayload.js";
import type * as mutations_duel from "../mutations/duel.js";
import type * as submissions_submitCompletion from "../submissions/submitCompletion.js";
import type * as users_createUser from "../users/createUser.js";
import type * as users_getUserByWallet from "../users/getUserByWallet.js";
import type * as users_redeemVault from "../users/redeemVault.js";
import type * as utils_duelState from "../utils/duelState.js";
import type * as utils_tier from "../utils/tier.js";
import type * as utils_time from "../utils/time.js";
import type * as utils_username from "../utils/username.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/getChallenge": typeof auth_getChallenge;
  "auth/verifyWallet": typeof auth_verifyWallet;
  "duels/cancelOpenDuel": typeof duels_cancelOpenDuel;
  "duels/computeOutcome": typeof duels_computeOutcome;
  "duels/createFriendDuel": typeof duels_createFriendDuel;
  "duels/finalizeSettlement": typeof duels_finalizeSettlement;
  "duels/getActiveDuels": typeof duels_getActiveDuels;
  "duels/getDuelById": typeof duels_getDuelById;
  "duels/getDuelProgress": typeof duels_getDuelProgress;
  "duels/getOpenDuels": typeof duels_getOpenDuels;
  "duels/getProgramConfig": typeof duels_getProgramConfig;
  "duels/getScheduledDuels": typeof duels_getScheduledDuels;
  "duels/getUserByWallet": typeof duels_getUserByWallet;
  "duels/getUserDuels": typeof duels_getUserDuels;
  "duels/helpers": typeof duels_helpers;
  "duels/joinFriendDuel": typeof duels_joinFriendDuel;
  "duels/prepareSettlement": typeof duels_prepareSettlement;
  "duels/startDuel": typeof duels_startDuel;
  "lib/auth": typeof lib_auth;
  "lib/sha": typeof lib_sha;
  "lib/signPayload": typeof lib_signPayload;
  "mutations/duel": typeof mutations_duel;
  "submissions/submitCompletion": typeof submissions_submitCompletion;
  "users/createUser": typeof users_createUser;
  "users/getUserByWallet": typeof users_getUserByWallet;
  "users/redeemVault": typeof users_redeemVault;
  "utils/duelState": typeof utils_duelState;
  "utils/tier": typeof utils_tier;
  "utils/time": typeof utils_time;
  "utils/username": typeof utils_username;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
