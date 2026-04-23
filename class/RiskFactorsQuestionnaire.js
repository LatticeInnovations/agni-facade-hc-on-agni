const heartcareUrls = require("../utils/heartcareSystemUrl");
class RiskFactorQuestionnaire {
  constructor(questionnaireObj, fhirResource) {
    this.questionnaireObj = questionnaireObj;
    this.fhirResource = fhirResource;
  }

  setData() {
    this.fhirResource = {
      resourceType: "Questionnaire",
      identifier: [
        {
          system: heartcareUrls.identifierUrl,
          value: this.questionnaireObj.questionnaireId,
        },
      ],
      "title": this.questionnaireObj.questionnaireName,
      "name": this.questionnaireObj.questionnaireName,
      "status": "active",
      "description": "Questionnaire for patient's risk factors - medication history section",
            
      item: [
        {
          linkId: "tobacco",
          text: "Tobacco Use",
          type: "group",
          item: [
            {
              linkId: "tobaccoUser",
              text: "Do you currently use any tobacco products?",
              type: "boolean",
            },
            {
              linkId: "tobaccoItemType",
              text: "Which tobacco product do you use the most?",
              type: "choice",
              enableWhen: [
                { question: "tobaccoUser", operator: "=", answerBoolean: true },
              ],
              answerOption: [
                { valueCoding: { code: "1", display: "Cigarettes" } },
                { valueCoding: { code: "2", display: "Cigars" } },
                { valueCoding: { code: "3", display: "Pipes" } },
                { valueCoding: { code: "4", display: "Bidis and kreteks" } },
                { valueCoding: { code: "5", display: "Hookah" } },
                { valueCoding: { code: "6", display: "Chewing tobacco" } },
                { valueCoding: { code: "7", display: "Snuff" } },
                { valueCoding: { code: "8", display: "Dissolvables" } },
                {
                  valueCoding: { code: "9", display: "Electronic cigarettes" },
                },
                { valueCoding: { code: "10", display: "Other" } },
              ],
            },
            {
              linkId: "tobaccoOther",
              text: "Specify other tobacco product",
              type: "string",
              enableWhen: [
                {
                  question: "tobaccoItemType",
                  operator: "=",
                  answerCoding: { code: "10" },
                },
              ],
            },
            {
              linkId: "consumptionAmount",
              text: "On average, how many of the tobacco product above do you use each day?",
              type: "integer",
              enableWhen: [
                { question: "tobaccoUser", operator: "=", answerBoolean: true },
              ],
            },
            {
              linkId: "consumptionUnit",
              text: "Unit of consumption",
              type: "choice",
              enableWhen: [
                { question: "tobaccoUser", operator: "=", answerBoolean: true },
              ],
              answerOption: [
                { valueCoding: { code: "times", display: "Times" } },
                { valueCoding: { code: "sticks", display: "Sticks" } },
              ],
            },
            {
              linkId: "startAge",
              text: "How old were you when you first started using tobacco products?",
              type: "integer",
              enableWhen: [
                { question: "tobaccoUser", operator: "=", answerBoolean: true },
              ],
            },
            {
              linkId: "willingToQuit",
              text: "Are you willing to make a quit attempt now?",
              type: "boolean",
              enableWhen: [
                { question: "tobaccoUser", operator: "=", answerBoolean: true },
              ],
            },
          ],
        },
        {
          linkId: "alcohol",
          text: "Alcohol Use",
          type: "group",
          item: [
            {
              linkId: "consumedWithin30Days",
              text: "Have you consumed any alcohol in the past 30 days?",
              type: "boolean",
            },
            {
              linkId: "alcoholQ1",
              text: "During the past 30 days, on how many occasions did you have at least one standard alcoholic drink?",
              type: "integer",
              enableWhen: [
                {
                  question: "consumedWithin30Days",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "alcoholQ2",
              text: "During past 30 days, when you drank alcohol, how many standard drinks on average did you have during one drinking occasion?",
              type: "integer",
              enableWhen: [
                {
                  question: "consumedWithin30Days",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "alcoholQ3",
              text: "During past 30 days, how many times did you have six or more standard drinks in a single drinking occasion?",
              type: "integer",
              enableWhen: [
                {
                  question: "consumedWithin30Days",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
          ],
        },
        {
          linkId: "fruitVegetable",
          text: "Fruits and Vegetables",
          type: "group",
          item: [
            {
              linkId: "consumptionInWeek",
              text: "In a typical week do you eat any fruits or vegetables?",
              type: "boolean",
            },
            {
              linkId: "fruitsDays",
              text: "In a typical week, how many days do you eat fruits?",
              type: "integer",
              enableWhen: [
                {
                  question: "consumptionInWeek",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "fruitServings",
              text: "How many servings of fruits do you eat on one of these days?",
              type: "integer",
              enableWhen: [
                {
                  question: "consumptionInWeek",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "vegetableDays",
              text: "In a typical week, how many days do you eat vegetables?",
              type: "integer",
              enableWhen: [
                {
                  question: "consumptionInWeek",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "vegetableServings",
              text: "How many servings of vegetables do you eat on one of these days?",
              type: "integer",
              enableWhen: [
                {
                  question: "consumptionInWeek",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
          ],
        },
        {
          linkId: "physicalActivity",
          text: "Physical Activity",
          type: "group",
          item: [
            {
              linkId: "weeklyEngagement",
              text: "In a typical week, do you engage in any moderate to vigorous intensity activities (either as a part of work, travel to and from places or recreational activities) for at least 10 minutes continuously?",
              type: "boolean",
            },
            {
              linkId: "vigorousDays",
              text: "In a typical week, how many days do you do vigorous intensity activities (either as a part of work, travel to and from places or recreational activities)?",
              type: "integer",
              enableWhen: [
                {
                  question: "weeklyEngagement",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "vigorousTime",
              text: "How much time do you spend doing vigorous-intensity activity at work on a typical day?",
              type: "integer",
              enableWhen: [
                {
                  question: "weeklyEngagement",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "moderateDays",
              text: "In a typical week, how many days do you do moderate intensity activities (either as a part of work, travel to and from places or recreational activities)?",
              type: "integer",
              enableWhen: [
                {
                  question: "weeklyEngagement",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
            {
              linkId: "moderateTime",
              text: "How much time do you spend doing moderate-intensity activity at work on a typical day?",
              type: "integer",
              enableWhen: [
                {
                  question: "weeklyEngagement",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
          ],
        },
        {
          linkId: "salt",
          text: "Salt Intake",
          type: "group",
          item: [
            {
              linkId: "saltAmount",
              text: "How much salt or salty sauce do you think you consume?",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Far too little" },
                { valueInteger: 2, display: "Too little" },
                { valueInteger: 3, display: "Just the right amount" },
                { valueInteger: 4, display: "Too much" },
                { valueInteger: 5, display: "Far too much" },
                { valueInteger: 6, display: "Don't know" },
              ],
            },
            {
              linkId: "saltAddMeal",
              text: "How often do you add salt or a salty sauce such as soya sauce to your food right before you eat it or as you are eating it?",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Never" },
                { valueInteger: 2, display: "Rarely" },
                { valueInteger: 3, display: "Sometimes" },
                { valueInteger: 4, display: "Often" },
                { valueInteger: 5, display: "Always" },
                { valueInteger: 6, display: "Don't know" },
              ],
            },
            {
              linkId: "saltAddCooking",
              text: "How often is salt, a salty seasoning or a salty sauce added in cooking or preparing food in your household?",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Never" },
                { valueInteger: 2, display: "Rarely" },
                { valueInteger: 3, display: "Sometimes" },
                { valueInteger: 4, display: "Often" },
                { valueInteger: 5, display: "Always" },
                { valueInteger: 6, display: "Don't know" },
              ],
            },
            {
              linkId: "saltProcessedFood",
              text: "How often do you eat processed food high in salt?",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Never" },
                { valueInteger: 2, display: "Rarely" },
                { valueInteger: 3, display: "Sometimes" },
                { valueInteger: 4, display: "Often" },
                { valueInteger: 5, display: "Always" },
                { valueInteger: 6, display: "Don't know" },
              ],
            },
          ],
        },
        {
          linkId: "fatsOils",
          text: "Fats and Oils",
          type: "group",
          item: [
            {
              linkId: "oilUsed",
              text: "What type of oil or fat is most often used for meal preparation in your household?",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Vegetable Oil" },
                { valueInteger: 2, display: "Lard or suet" },
                { valueInteger: 3, display: "Butter or ghee" },
                { valueInteger: 4, display: "Margarine" },
                { valueInteger: 5, display: "Others" },
                { valueInteger: 6, display: "None used" },
                { valueInteger: 7, display: "Don’t know" },
              ],
            },
            {
              linkId: "otherFatAndOils",
              text: "Specify other fat or oil used",
              type: "string",
              enableWhen: [
                { question: "oilUsed", operator: "=", answerInteger: 5 },
              ],
            },
            {
              linkId: "fatFoodFrequency",
              text: "During the past 30 days, how many times per day did you usually eat food high in fat?",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Did not eat" },
                { valueInteger: 2, display: "Less than once a day" },
                { valueInteger: 3, display: "Once a day" },
                { valueInteger: 4, display: "2 times per day" },
                { valueInteger: 5, display: "3 times per day" },
                { valueInteger: 6, display: "4 times per day" },
                { valueInteger: 7, display: "5 or more times per day" },
              ],
            },
          ],
        },
        {
          linkId: "sugars",
          text: "Sugars",
          type: "group",
          item: [
            {
              linkId: "softDrinkFrequency",
              text: "During the past 30 days, how many times per day did you usually drink carbonated soft drinks? Do not include diet soft drinks.",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Did not drink" },
                { valueInteger: 2, display: "Less than once a day" },
                { valueInteger: 3, display: "Once a day" },
                { valueInteger: 4, display: "2 times per day" },
                { valueInteger: 5, display: "3 times per day" },
                { valueInteger: 6, display: "4 times per day" },
                { valueInteger: 7, display: "5 or more times per day" },
              ],
            },
            {
              linkId: "juiceFrequency",
              text: "During the past 30 days, how many times per day did you usually drink fruit juice?",
              type: "choice",
              answerOption: [
                { valueInteger: 1, display: "Did not drink" },
                { valueInteger: 2, display: "Less than once a day" },
                { valueInteger: 3, display: "Once a day" },
                { valueInteger: 4, display: "2 times per day" },
                { valueInteger: 5, display: "3 times per day" },
                { valueInteger: 6, display: "4 times per day" },
                { valueInteger: 7, display: "5 or more times per day" },
              ],
            },
          ],
        },
        {
          linkId: "mealsNotFromHomeGroup",
          text: "Meals not prepared at home",
          type: "group",
          item: [
            {
              linkId: "eatsOut",
              text: "On average, how many meals per week do you eat that were not prepared at a home? By meal, I mean, breakfast, lunch or dinner.",
              type: "boolean",
            },
            {
              linkId: "mealsPerWeek",
              text: "How many such meals do you eat per week (breakfast, lunch, or dinner)?",
              type: "integer",
              enableWhen: [
                {
                  question: "eatsOut",
                  operator: "=",
                  answerBoolean: true,
                },
              ],
            },
          ],
        },
      ],
    };
  }

  getJsonToFhirTranslator() {
    this.setData();
  }
  getFHIRResource() {
    return this.fhirResource;
  }
}

module.exports = RiskFactorQuestionnaire;
