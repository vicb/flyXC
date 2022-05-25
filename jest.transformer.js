module.exports = {
  process(fileContent) {
    return { code: 'module.exports = ' + JSON.stringify(fileContent) };
  },
};
