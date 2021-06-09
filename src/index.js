const pkg = require('../package.json')
const ProductHunt = require('producthunt')
const moment = require('moment')
const OrbitActivities = require('@orbit-love/activities')

class OrbitProductHunt {
    constructor(orbitWorkspaceId, orbitApiKey, productHuntApiKey, productHuntApiSecret) {
        this.credentials = this.checkCredentials(orbitWorkspaceId, orbitApiKey, productHuntApiKey, productHuntApiSecret)
        this.orbit = new OrbitActivities(this.credentials.orbitWorkspaceId, this.credentials.orbitApiKey, `community-js-producthunt-orbit/${pkg.version}`)
        this.productHunt = new ProductHunt({
            client_id: this.credentials.productHuntApiKey,
            client_secret: this.credentials.productHuntApiSecret,
            grant_type: 'client_credentials'
        })
    }

    checkCredentials(oWs, oKey, phKey, phSec) {
        const orbitWorkspaceId = oWs || process.env.ORBIT_WORKSPACE_ID
        const orbitApiKey = oKey || process.env.ORBIT_API_KEY
        const productHuntApiKey = phKey || process.env.PRODUCT_HUNT_API_KEY
        const productHuntApiSecret = phSec || process.env.PRODUCT_HUNT_API_SECRET

        if(!orbitWorkspaceId || !orbitApiKey || !productHuntApiKey || !productHuntApiSecret) {
            throw new Error('You must initialize the OrbitProductHunt package with: orbitWorkspaceId, orbitApiKey, productHuntApiKey, productHuntApiSecret')
        } else {
            return { orbitWorkspaceId, orbitApiKey, productHuntApiKey, productHuntApiSecret }
        }
    }

    getProducts(id) {
        return new Promise((resolve, reject) => {
            this.productHunt.users.show({ id }, (err, res) => {
                if(err) reject(err)
                if(res) {
                    const made = JSON.parse(res.body).user.maker_of
                    const products = []
                    for(let product of made) {
                        const { name, id } = product
                        products.push({ name, id })
                    }
                    resolve(products)
                }
            })
        })
    }

    getVotesPage(post_id, older) {
        return new Promise((resolve, reject) => {
            this.productHunt.votes.index({ post_id, params: { older, order: 'desc' } }, (err, res) => {
                if(err) reject(err)
                const body = JSON.parse(res.body)
                resolve(body.votes)
            })
        })
    }

    getVotes(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const initialPage = await this.getVotesPage(id)
                let votes = [...initialPage]
                let isMore = true
                while(isMore) {
                    const latestVoteId = votes[votes.length-1].id
                    const page = await this.getVotesPage(id, latestVoteId)
                    if(page.length > 0) {
                        votes = [...votes, ...page]
                    } else {
                        isMore = false
                    }
                }
                resolve(votes)
            } catch(error) {
                reject(error)
            }
        })
    }

    prepareVotes(list, hours = 1) {
        return new Promise(resolve => {
            const filtered = list.filter(item => {
                return moment().diff(moment(item.created_at), 'hours', true) < hours
            })
            const prepared = filtered.map(item => {
                return {
                    activity: {
                        title: `Upvoted on Product Hunt`,
                        tags: ['channel:producthunt'],
                        activity_type: 'producthunt:vote',
                        key: `producthunt-vote-${item.id}`,
                        occurred_at: new Date(item.created_at).toISOString(),
                        member: { twitter: item.user.twitter_username }
                    },
                    identity: {
                        source: 'Product Hunt',
                        source_host: 'producthunt.com',
                        username: item.user.username,
                        url: item.user.profile_url,
                        uid: item.user.id
                    }
                }
            })
            resolve(prepared)
        })
    }

    getCommentsPage(post_id, older) {
        return new Promise((resolve, reject) => {
            this.productHunt.comments.index({ post_id, params: { older, order: 'desc' } }, (err, res) => {
                if(err) reject(err)
                const body = JSON.parse(res.body)
                let comments = body.comments
                let children = []
                for(let comment of comments) {
                    children = [...children, ...comment.child_comments]
                }
                resolve({ comments, children })
            })
        })
    }

    getComments(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const initialPage = await this.getCommentsPage(id)
                let comments = [...initialPage.comments]
                let children = [...initialPage.children]
                let isMore = true
                while(isMore) {
                    const latestCommentId = comments[comments.length-1].id
                    const page = await this.getCommentsPage(id, latestCommentId)
                    if(page.comments.length > 0) {
                        comments = [...comments, ...page.comments]
                        children = [...children, ...page.children]
                    } else {
                        isMore = false
                    }
                }
                resolve([...comments, ...children])
            } catch(error) {
                reject(error)
            }
        })
    }

    prepareComments(list, hours = 1) {
        return new Promise(resolve => {
            const filtered = list.filter(item => {
                return moment().diff(moment(item.created_at), 'hours', true) < hours
            })
            const prepared = filtered.map(item => {
                return {
                    activity: {
                        title: `Commented on Product Hunt`,
                        description: item.body,
                        tags: ['channel:producthunt'],
                        activity_type: 'producthunt:comment',
                        key: `producthunt-comment-${item.id}`,
                        occurred_at: new Date(item.created_at).toISOString(),
                        link: item.url,
                        link_text: 'View on Product Hunt',
                        member: { twitter: item.user.twitter_username }
                    },
                    identity: {
                        source: 'Product Hunt',
                        source_host: 'producthunt.com',
                        username: item.user.username,
                        url: item.user.profile_url,
                        uid: item.user.id
                    }
                }
            })
            resolve(prepared)
        })
    }

    addActivities(activities) {
        return new Promise(async (resolve, reject) => {
            try {
                let stats = { added: 0, duplicates: 0, errors: [] }
                for(let activity of activities) {
                    await this.orbit.createActivity(activity)
                        .then(() => { stats.added++ })
                        .catch(err => {
                            if(err.errors.key) stats.duplicates++
                            else { errors.push(err) }
                        })
                }
                resolve(stats)
            } catch(error) {
                reject(error)
            }
        })
    }


}

module.exports = OrbitProductHunt
