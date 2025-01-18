// inquirerChoose用于显示模板列表，用户可以通过上下键选择克隆的项目模板。
// inquirerConfirm用于询问用户，比如存在同名文件夹时是否覆盖（y/n），用户可以输入y/n返回一个布尔值结果。
// inquirerInputs用于接收用户输入的一些项目信息，比如项目名称，项目描述等等。

import inquirer from 'inquirer'
// 封装命令行交互的相关方法

/**
 * @param {string} message 询问提示语句
 * @returns {Object} 根据name属性获取用户输入的值{confirm: y/n}
 */
export const inquirerConfirm = async (message) => {
  const answer = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message
  })
  return answer
}

/**
 *
 * @param {string} message 询问提示语句
 * @param {Array} choices 选择模板列表，默认读取对象的name属性
 * @returns {Object} 根据name属性获取用户输入的值{请选择项目模板: xxxxxx}
 */
export const inquirerChoose = async (message, choices) => {
  const answer = await inquirer.prompt({
    type: 'list',
    name: 'choose',
    message,
    choices
  })
  return answer
}

/**
 * @param {Array} messages  询问提示语句数组
 * @returns {Object} 结果对象
 */
export const inquirerInputs = async (messages) => {
  const questions = messages.map((msg) => {
    return {
      name: msg.name,
      type: 'input',
      message: msg.message
    }
  })
  const answers = await inquirer.prompt(questions)
  return answers
}
