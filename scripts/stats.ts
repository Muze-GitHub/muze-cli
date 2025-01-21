import { execSync } from 'child_process'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'

interface StatsOptions {
  git?: boolean // Git 统计
  code?: boolean // 代码统计
  all?: boolean // 全部统计
}

export default async function stats(options: StatsOptions = {}) {
  try {
    const spinner = ora('正在统计项目信息...').start()

    // 检查是否在项目根目录
    if (!fs.existsSync('package.json')) {
      spinner.fail(chalk.red('请在项目根目录下运行此命令'))
      return
    }

    // Git 统计
    if (options.git || options.all || !Object.keys(options).length) {
      spinner.text = '正在统计 Git 信息...'
      if (fs.existsSync('.git')) {
        console.log('\n' + chalk.blue('📊 Git 统计:'))

        // 提交次数
        const commitCount = execSync('git rev-list --count HEAD')
          .toString()
          .trim()
        console.log(chalk.gray(`总提交次数: ${commitCount}`))

        // 贡献者数量
        const contributorCount = execSync(
          'git log --pretty="%an" | sort -u | wc -l'
        )
          .toString()
          .trim()
        console.log(chalk.gray(`贡献者数量: ${contributorCount}`))

        // 最近一次提交
        const lastCommit = execSync('git log -1 --pretty="%B"')
          .toString()
          .trim()
        console.log(chalk.gray(`最近提交: ${lastCommit}`))
      } else {
        console.log(chalk.yellow('⚠️ 未找到 Git 仓库'))
      }
    }

    // 代码统计
    if (options.code || options.all || !Object.keys(options).length) {
      spinner.text = '正在统计代码信息...'
      console.log('\n' + chalk.blue('📝 代码统计:'))

      // 统计文件数量
      const files = getAllFiles('.')
      const stats = {
        ts: files.filter((f) => f.endsWith('.ts')).length,
        js: files.filter((f) => f.endsWith('.js')).length,
        json: files.filter((f) => f.endsWith('.json')).length,
        total: files.length
      }

      console.log(chalk.gray(`TypeScript 文件: ${stats.ts}`))
      console.log(chalk.gray(`JavaScript 文件: ${stats.js}`))
      console.log(chalk.gray(`JSON 文件: ${stats.json}`))
      console.log(chalk.gray(`总文件数: ${stats.total}`))

      // 统计代码行数
      let totalLines = 0
      files.forEach((file) => {
        if (file.match(/\.(ts|js|json)$/)) {
          const content = fs.readFileSync(file, 'utf-8')
          totalLines += content.split('\n').length
        }
      })
      console.log(chalk.gray(`总代码行数: ${totalLines}`))
    }

    spinner.succeed(chalk.green('统计完成!'))
  } catch (error) {
    console.error(chalk.red('\n❌ 统计失败:'))
    if (error instanceof Error) {
      console.error(chalk.red(error.message))
    }
    process.exit(1)
  }
}

// 递归获取所有文件
function getAllFiles(dir: string): string[] {
  const files: string[] = []
  const items = fs.readdirSync(dir)

  items.forEach((item) => {
    const fullPath = path.join(dir, item)
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', 'dist'].includes(item)) {
        files.push(...getAllFiles(fullPath))
      }
    } else {
      files.push(fullPath)
    }
  })

  return files
}
