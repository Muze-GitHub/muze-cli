// removeDir主要是在项目创建的过程中，如果存在同名文件夹可以调用此方法删除目录，然后再创建项目。
// changePackageJson就是将用户输入的交互信息（项目名称，描述）更新到项目的package.json文件中。

import fs from 'fs-extra'
import chalk from 'chalk'
import path from 'path'
import logSymbols from 'log-symbols'

const appDirectory = fs.realpathSync(process.cwd())
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath)

// 删除文件夹
export async function removeDir(dir) {
  try {
    await fs.remove(resolveApp(dir))
    console.log(logSymbols.warning, `已覆盖同名文件夹${dir}`)
  } catch (err) {
    console.log(err)
    return
  }
}

// 修改package.json配置
export async function changePackageJson(name, info) {
  try {
    const pkg = await fs.readJson(resolveApp(`${name}/package.json`))
    Object.keys(info).forEach((item) => {
      if (info[item] && info[item].trim()) {
        pkg[item] = info[item]
      }
    })
    await fs.writeJson(resolveApp(`${name}/package.json`), pkg, { spaces: 2 })
  } catch (err) {
    console.log(err)
    console.log(
      logSymbols.warning,
      chalk.yellow('更新项目信息失败,请手动修改package.json')
    )
  }
}
