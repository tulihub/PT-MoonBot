class RegistrationHandler {

    async checkLicence() {
        return {state: "VALID"};
    }

}

module.exports = RegistrationHandler;