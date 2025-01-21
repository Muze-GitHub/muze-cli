import { execSync } from 'child_process'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'

interface AnalyzeOptions {
  deps?: boolean // 分析依赖
  bundle?: boolean // 分析打包体积
  time?: boolean // 分析构建时间
}

export default async function analyze(options: AnalyzeOptions = {}) {
  try {
    const spinner = ora('正在分析项目...').start()

    // 检查是否在项目根目录
    if (!fs.existsSync('package.json')) {
      spinner.fail(chalk.red('请在项目根目录下运行此命令'))
      return
    }

    // 如果没有指定任何选项，则执行所有分析
    const shouldAnalyzeAll = Object.keys(options).length === 0

    // 分析依赖
    if (options.deps || shouldAnalyzeAll) {
      spinner.text = '正在分析依赖...'
      try {
        const depReport = execSync('npm list --json').toString()
        const deps = JSON.parse(depReport)
        console.log('\n' + chalk.blue('📦 依赖分析:'))
        console.log(
          chalk.gray(`总依赖数: ${Object.keys(deps.dependencies || {}).length}`)
        )

        // 检查过期依赖
        const outdatedOutput = execSync('npm outdated --json').toString()
        const outdatedDeps = JSON.parse(outdatedOutput || '{}')
        const outdatedCount = Object.keys(outdatedDeps).length
        console.log(chalk.gray(`过期依赖: ${outdatedCount}`))

        if (outdatedCount > 0) {
          console.log('\n' + chalk.yellow('需要更新的依赖:'))
          Object.entries(outdatedDeps).forEach(
            ([name, info]: [string, any]) => {
              console.log(
                chalk.gray(`${name}: ${info.current} -> ${info.latest}`)
              )
            }
          )
        }
      } catch (error) {
        console.log(
          chalk.yellow('\n⚠️ 依赖分析过程中出现警告，但不影响其他分析继续进行')
        )
      }
    }

    // 分析打包体积
    if (options.bundle || shouldAnalyzeAll) {
      spinner.text = '正在分析打包体积...'
      console.log('\n' + chalk.blue('📊 打包体积分析:'))

      // 检查是否存在 webpack 配置文件
      const webpackConfigFiles = [
        'webpack.config.js',
        'webpack.config.ts',
        'next.config.js',
        'next.config.ts',
        'vite.config.js',
        'vite.config.ts'
      ]

      const configFile = webpackConfigFiles.find((file) => fs.existsSync(file))

      if (configFile) {
        console.log(chalk.gray(`找到配置文件: ${configFile}`))
        try {
          // 修改 webpack 配置以添加分析器
          const tempConfigPath = 'webpack.analyze.js'
          const configContent = `
            const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
            const originalConfig = require('./${configFile}');
            
            module.exports = {
              ...originalConfig,
              plugins: [
                ...(originalConfig.plugins || []),
                new BundleAnalyzerPlugin({
                  analyzerMode: 'static',
                  reportFilename: 'bundle-analysis.html',
                  openAnalyzer: true
                })
              ]
            };
          `

          fs.writeFileSync(tempConfigPath, configContent)
          execSync(`webpack --config ${tempConfigPath}`, { stdio: 'inherit' })
          fs.unlinkSync(tempConfigPath)

          console.log(
            chalk.green('\n✨ 打包分析报告已生成，请查看 bundle-analysis.html')
          )
        } catch (error) {
          console.log(
            chalk.yellow('\n⚠️ 打包分析失败，请确保已安装 webpack 相关依赖')
          )
          console.log(
            chalk.gray('提示: 运行 npm install webpack webpack-cli --save-dev')
          )
        }
      } else {
        console.log(
          chalk.yellow('⚠️ 未找到 webpack 配置文件，无法进行打包体积分析')
        )
        console.log(chalk.gray('提示: 请确保项目中包含 webpack 配置文件'))
      }
    }

    // 分析构建时间
    if (options.time || shouldAnalyzeAll) {
      spinner.text = '正在分析构建时间...'
      console.log('\n' + chalk.blue('⏱️ 构建时间分析:'))

      try {
        const startTime = Date.now()
        execSync('npm run build', { stdio: 'pipe' })
        const endTime = Date.now()
        const buildTime = endTime - startTime

        console.log(
          chalk.gray(
            `构建总耗时: ${buildTime}ms (${(buildTime / 1000).toFixed(2)}s)`
          )
        )

        // 添加构建时间评估
        if (buildTime < 10000) {
          console.log(chalk.green('✨ 构建速度良好'))
        } else if (buildTime < 30000) {
          console.log(chalk.yellow('⚠️ 构建速度一般，可以考虑优化'))
        } else {
          console.log(chalk.red('❗ 构建速度较慢，建议进行优化'))
          console.log(chalk.gray('优化建议:'))
          console.log(chalk.gray('1. 使用构建缓存'))
          console.log(chalk.gray('2. 优化依赖体积'))
          console.log(chalk.gray('3. 使用并行构建'))
        }
      } catch (error) {
        console.log(chalk.yellow('\n⚠️ 构建过程失败，请检查项目配置'))
      }
    }

    spinner.succeed(chalk.green('分析完成!'))
  } catch (error) {
    console.error(chalk.red('\n❌ 分析失败:'))
    if (error instanceof Error) {
      console.error(chalk.red(error.message))
    }
    process.exit(1)
  }
}
