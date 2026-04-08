# Hui 阶段一使用说明

## 1. 部署目标

本 fork 的默认部署目标是 DockerHub 镜像 `mokoyee/inventree:latest`，并默认启用：

- 简体中文：`INVENTREE_LANGUAGE=zh-hans`
- 上海时区：`INVENTREE_TIMEZONE=Asia/Shanghai`
- 一期初始化：`INVENTREE_HUI_BOOTSTRAP=True`

## 2. 服务器部署

在服务器准备以下文件：

- `contrib/container/docker-compose.yml`
- `contrib/container/.env`
- `contrib/container/Caddyfile`

建议步骤：

```bash
docker compose pull
docker compose up -d
docker compose run --rm inventree-server invoke update
docker compose run --rm inventree-server invoke superuser
```

部署前至少修改 `.env` 中这些值：

- `INVENTREE_SITE_URL`
- `INVENTREE_DB_USER`
- `INVENTREE_DB_PASSWORD`
- `INVENTREE_IMAGE=mokoyee/inventree`
- `INVENTREE_TAG=latest`

如果希望首次启动直接生成管理员，也可以提前配置：

- `INVENTREE_ADMIN_USER`
- `INVENTREE_ADMIN_PASSWORD`
- `INVENTREE_ADMIN_EMAIL`

## 3. 业务字段落地方式

第一阶段通过启动 bootstrap 自动创建这些零件参数模板：

- `样品初次到店时间`
- `销售单价`
- `抖店上架数量`
- `视频号上架数量`

使用方式：

- 商品主图：上传到 `Part.image`。
- 样品照片：本阶段直接等同于主图，不再单独维护附件流程。
- 大货入库：创建或补充 Stock Item。
- 出库：执行库存扣减，并在备注里填写原因。

## 4. 出库备注规范

一期不改表结构，统一在库存操作备注中使用以下前缀：

- `内部购买`
- `抖店销售`
- `视频号销售`
- `样品外借`

推荐格式：

```text
抖店销售｜主播间杯子补单 3 个
```

这样可以直接利用现有 Stock Tracking 历史做追溯和搜索。

## 5. 权限建议

启动 bootstrap 后会自动创建两个用户组：

- `仓储人员`：可查看分类，可新增/编辑商品、库存和库位
- `普通员工`：仅查看商品、库存和库位

不要给普通用户和仓储人员 `delete` 权限。只有超级管理员保留删除和系统级管理权限。

## 6. 如何核查操作记录

库存相关操作可在以下位置查看：

- Part 详情页的 `Stock History`
- Stock Item 详情页的 `Stock Tracking`

每条记录都会保留：

- 操作时间
- 操作用户
- 数量变化
- 备注信息

这已经可以满足阶段一的“谁在什么时候做了出入库操作”要求。
