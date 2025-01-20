import inquirer from 'inquirer'
import { execSync } from 'child_process'
import { commitTypes } from './constants.js'
import chalk from 'chalk'

export default async function commit() {
  try {
    // 获取提交类型
    const { type } = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '请选择你的代码的提交类型:',
        choices: commitTypes
      }
    ])

    // 获取提交信息
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: '请输入你的提交消息:',
        validate: (input: string) => {
          if (!input.trim()) {
            return '提交消息不能为空'
          }
          return true
        }
      }
    ])

    // 执行 git commit 命令
    const commitMessage = `${type}: ${message}`
    execSync('git add .')
    execSync(`git commit -m "${commitMessage}"`)

    console.log(chalk.green('\n✨ 提交成功!'))
    console.log(chalk.blue(`提交消息: ${commitMessage}\n`))
  } catch (error) {
    console.error(chalk.red('\n❌ 提交失败:'))
    if (error instanceof Error) {
      console.error(chalk.red(error.message))
    }
    process.exit(1)
  }
}
