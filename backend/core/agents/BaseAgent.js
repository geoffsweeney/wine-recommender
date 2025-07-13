"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
var BaseAgent = /** @class */ (function () {
    function BaseAgent(id, config, dependencies) {
        this.id = id;
        this.config = config;
        this.dependencies = dependencies;
        this.validateConfig(config);
        this.state = this.getInitialState();
    }
    return BaseAgent;
}());
exports.BaseAgent = BaseAgent;
