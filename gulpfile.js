const gulp = require("gulp");
const fs = require("fs");
const UglifyJS = require("uglify-es");

gulp.task('default', function () {

    const isLineAComment = function (aLine) {
        const lineStartsWithComment = (
            aLine.indexOf("// ") === 0 ||
            aLine.indexOf("/*") === 0 ||
            aLine.indexOf(" */") === 0 ||
            aLine.indexOf(" * ") === 0
        );
        return lineStartsWithComment;
    };

    const builtScriptComment = "/** This file is automatically generated. **/\n";
    const standardsDefDir = "data/standards";

    // Build all the standards listings into a single features.js file.
    const combinedStandards = fs.readdirSync(standardsDefDir)
        .reduce(function (prev, next) {

            if (next.indexOf(".json") === -1) {
                return prev;
            }

            const fileContents = fs.readFileSync(standardsDefDir + "/" + next, {encoding: "utf8"});
            const standardContents = JSON.parse(fileContents);
            const nameParts = [standardContents.info.name, standardContents.info.subsection_name].filter(part => !!part);
            const standardIdenitifer = nameParts.join(": ").trim();
            standardContents.info.idenitifer = standardIdenitifer;
            prev[standardIdenitifer] = standardContents;
            return prev;
        }, {});

    const renderedStandardsModule = builtScriptComment + `window.WEB_API_MANAGER.standards = ${JSON.stringify(combinedStandards)};`;

    fs.writeFileSync("content_scripts/dist/standards.js", renderedStandardsModule);

    const proxyBlockSrc = fs.readFileSync("content_scripts/src/proxyblock.js", "utf8");
    const instrumentSrc = fs.readFileSync("content_scripts/src/instrument.js", "utf8");

    const stripCommentsFromSource = function (source) {
        const fileLines = source.split("\n");
        const linesWithoutComments = fileLines.filter(aLine => !isLineAComment(aLine));
        return linesWithoutComments.join("\n");
    };

    const proxyBlockSrcWOComments = stripCommentsFromSource(proxyBlockSrc);
    const instrumentSrcWOComments = stripCommentsFromSource(instrumentSrc);

    const proxyBlockSrcWithHeader = "/** This code is a minified version of content_scripts/src/proxyblock.js **/\n" + proxyBlockSrcWOComments;
    const instrumentSrcWithProxyInjected = instrumentSrcWOComments.replace(
        "###-INJECTED-PROXY-BLOCKING-CODE-###",
        UglifyJS.minify(proxyBlockSrcWithHeader, {mangle: false}).code
    );

    fs.writeFileSync("content_scripts/dist/instrument.js", builtScriptComment + instrumentSrcWithProxyInjected);

    // Last, several content script files are just copied over, unmodified,
    // as script files to be injected.
    const srcFilesToCopy = ["defaults.js"];
    srcFilesToCopy.forEach(function (aSrcPath) {
        const scriptSrc = fs.readFileSync("content_scripts/src/" + aSrcPath, "utf8");
        const scriptSrcWOComments = stripCommentsFromSource(scriptSrc);
        fs.writeFileSync("content_scripts/dist/" + aSrcPath, builtScriptComment + scriptSrcWOComments);
    });
});
