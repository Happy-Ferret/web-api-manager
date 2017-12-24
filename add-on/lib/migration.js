/**
 * This module handles automatically moving stored preferences in the format
 * that prior versions of the extension used, to the current version.
 */
(function () {
    "use strict";

    const {constants, standardsLib} = window.WEB_API_MANAGER;
    const currentVersion = constants.schemaVersion;

    /**
     * Attempts to determine which version of the schema this extension data
     * was saved with.
     *
     * @param {object} data
     *   Persistent data loaded from the storage API in the extension.
     *
     * @return {number|false}
     *   Returns a number describing the used schema version, or false if
     *   the version could not be determined.
     */
    const guessDataVersion = data => {
        // If no data was provided, then treat it as matching the current
        // schema, since there is no data to migrate.
        if (Object.values(data).length === 0) {
            return currentVersion;
        }

        try {
            // Preferences data of any version should all be nested in a
            // "webApiManager" property of an object.
            if (data.webApiManager === undefined) {
                return false;
            }

            // The initial version of the schema didn't use a version number,
            // so assume that if we received an object that doesn't have a
            // "schema" property, that its version 1.
            if (data.webApiManager.schema === undefined) {
                return 1;
            }

            return data.webApiManager.schema;
        } catch (ignore) {
            // If we received something other than an object, or the
            // object is in an unexpected format, return false to indicate
            // we have no idea how to handle.
            return false;
        }
    };

    /**
     * Creates a new object, with the data stored in the version-1 schema
     * object, but in the format of the version-2 schema.
     *
     * @param {object} data
     *   Persistent data loaded from the storage API in the extension.
     *
     * @return {object}
     *   A new read only object, describing the same preferences, but in the
     *   schema 2 format.
     */
    const oneToTwo = data => {
        const migratedData = Object.create(null);
        migratedData.webApiManager = {};

        migratedData.webApiManager.shouldLog = data.webApiManager.shouldLog;
        migratedData.webApiManager.schema = 2;
        migratedData.webApiManager.rules = Object.entries(data.webApiManager.domainRules)
            .map(([matchPattern, stdIdStrs]) => {
                const stdIdNumbers = stdIdStrs.map(oldStdId => {
                    const intStdId = standardsLib.newIdForOldStandardId(oldStdId);
                    if (intStdId === undefined) {
                        throw `Unable to migrate standard id ${oldStdId}`;
                    }
                    return intStdId;
                });
                return Object.freeze({
                    p: matchPattern,
                    s: stdIdNumbers,
                });
            });

        Object.freeze(migratedData.webApiManager);
        return Object.freeze(migratedData);
    };

    /**
     * Apply any needed migrations to bring the structure of the given
     * stored preferences data to the current version.
     *
     * @param {?object} data
     *   Persistent data loaded from the storage API in the extension.
     *
     * @return {Array}
     *   An array of length two, the first a boolean if the migration process
     *   was successful (even if its a NOOP).  The second object is either
     *   the migrated data if successful, or a string describing the error
     *   if the data couldn't be migrated.
     */
    const applyMigrations = data => {
        const foundDataVersion = guessDataVersion(data);
        if (foundDataVersion === currentVersion) {
            return [true, data];
        }

        if (foundDataVersion === false) {
            return [false, `Unable to determine the version for ${JSON.stringify}`];
        }

        const migrations = [
            oneToTwo,
        ];

        let currentMigratedVersion = foundDataVersion;
        let currentMigratedData = data;

        // Apply all needed migrations to the loaded preferences data,
        // updating by one version each step (ie 1->2, 2->3, etc).
        while (currentMigratedVersion < currentVersion) {
            try {
                const migrationFunc = migrations[currentMigratedVersion - 1];
                currentMigratedData = migrationFunc(currentMigratedData);
            } catch (e) {
                return [false, `Invalid data: v: ${currentMigratedVersion}, data ${JSON.stringify(currentMigratedData)}, e: ${e}`];
            }
            currentMigratedVersion += 1;
        }

        return [true, currentMigratedData];
    };

    window.WEB_API_MANAGER.migrationLib = {
        applyMigrations,
    };
}());
