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

    addActivities(activities) {
        return new Promise((resolve, reject) => {
            try {
                const calls = activities.map(activity => this.orbit.createActivity(activity))
                Promise.allSettled(calls).then(results => {
                    let stats = { added: 0, duplicates: 0 }
                    for(let result of results) {
                        if(result.status != 'fulfilled') {
                            if(result.reason && result.reason.errors && result.reason.errors.key) {
                                stats.duplicates++
                            } else {
                                throw new Error(result.reason.errors)
                            }
                        } else {
                            stats.added++
                        }
                    }

                    let reply = `Added ${stats.added} activities to your Orbit workspace.`
                    if(stats.duplicates) reply += ` Your activity list had ${stats.duplicates} duplicates which were not imported`
                    resolve(reply)
                })
            } catch(error) {
                reject(error)
            }
        })
    }


}

module.exports = OrbitProductHunt
